/**
 * @jest-environment jsdom
 */
import { isTargetPage, injectButton, removeButton, inject } from './inject';
import { resetSpaState } from '../inject-utils';

const BUTTON_ID = 'termipus-btn-gitlab';

describe('gitlab/inject — isTargetPage', () => {
  it.each([
    '/group/repo/-/merge_requests/1',
    '/group/repo/-/issues/42',
    '/group/sub/repo/-/merge_requests/100',
  ])('returns true for %s', (path) => {
    expect(isTargetPage(path)).toBe(true);
  });

  it.each([
    '/',
    '/group/repo',
    '/group/repo/-/pipelines',
    '/group/repo/-/merge_requests',
  ])('returns false for %s', (path) => {
    expect(isTargetPage(path)).toBe(false);
  });
});

describe('gitlab/inject — injectButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing when toolbar not found', () => {
    injectButton();
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('injects button into toolbar', () => {
    document.body.innerHTML = '<div class="js-issuable-actions"></div>';
    injectButton();
    const btn = document.getElementById(BUTTON_ID);
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('⌨ Terminal');
  });

  it('does not inject duplicate button', () => {
    document.body.innerHTML = '<div class="js-issuable-actions"></div>';
    injectButton();
    injectButton();
    expect(document.querySelectorAll(`#${BUTTON_ID}`).length).toBe(1);
  });
});

describe('gitlab/inject — removeButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes existing button', () => {
    document.body.innerHTML = `<button id="${BUTTON_ID}"></button>`;
    removeButton();
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('does nothing when button absent', () => {
    expect(() => removeButton()).not.toThrow();
  });
});

describe('gitlab/inject — inject', () => {
  let origLocation: Location;

  beforeEach(() => {
    resetSpaState();
    document.body.innerHTML = '<div class="js-issuable-actions"></div>';
    origLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      value: { pathname: '/', hostname: 'gitlab.com' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    resetSpaState();
    Object.defineProperty(globalThis, 'location', {
      value: origLocation,
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = '';
  });

  it('does nothing on non-gitlab hostname', () => {
    inject('github.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('injects button on target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/group/repo/-/merge_requests/1';
    inject('gitlab.com');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('does not inject button on non-target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/group/repo';
    inject('gitlab.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('reacts to pushState navigation to target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/group/repo';
    inject('gitlab.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();

    (globalThis.location as { pathname: string }).pathname = '/group/repo/-/issues/5';
    history.pushState({}, '', '/group/repo/-/issues/5');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('removes button on pushState navigation away from target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/group/repo/-/issues/5';
    inject('gitlab.com');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();

    (globalThis.location as { pathname: string }).pathname = '/group/repo';
    history.pushState({}, '', '/group/repo');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('reacts to popstate event', () => {
    (globalThis.location as { pathname: string }).pathname = '/group/repo';
    inject('gitlab.com');

    (globalThis.location as { pathname: string }).pathname = '/group/repo/-/merge_requests/2';
    globalThis.dispatchEvent(new Event('popstate'));
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });
});
