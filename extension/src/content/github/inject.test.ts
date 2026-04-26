/**
 * @jest-environment jsdom
 */
import { isTargetPage, injectButton, removeButton, inject } from './inject';
import { resetSpaState } from '../inject-utils';

const BUTTON_ID = 'termipus-btn-github';

describe('github/inject — isTargetPage', () => {
  it.each([
    '/owner/repo/pull/1',
    '/owner/repo/issues/42',
    '/org/project/pull/100',
  ])('returns true for %s', (path) => {
    expect(isTargetPage(path)).toBe(true);
  });

  it.each([
    '/',
    '/owner/repo',
    '/owner/repo/pulls',
    '/owner/repo/issues',
  ])('returns false for %s', (path) => {
    expect(isTargetPage(path)).toBe(false);
  });
});

describe('github/inject — injectButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing when toolbar not found', () => {
    injectButton();
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('injects button into toolbar', () => {
    document.body.innerHTML = '<div data-component="PH_Actions"></div>';
    injectButton();
    const btn = document.getElementById(BUTTON_ID);
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('⌨ Terminal');
  });

  it('does not inject duplicate button', () => {
    document.body.innerHTML = '<div data-component="PH_Actions"></div>';
    injectButton();
    injectButton();
    expect(document.querySelectorAll(`#${BUTTON_ID}`).length).toBe(1);
  });
});

describe('github/inject — removeButton', () => {
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

describe('github/inject — inject', () => {
  let origLocation: Location;

  beforeEach(() => {
    resetSpaState();
    document.body.innerHTML = '<div data-component="PH_Actions"></div>';
    origLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      value: { pathname: '/', hostname: 'github.com' },
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

  it('does nothing on non-github hostname', () => {
    inject('gitlab.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('injects button on target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/owner/repo/pull/1';
    inject('github.com');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('does not inject button on non-target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/owner/repo';
    inject('github.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('reacts to pushState navigation to target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/owner/repo';
    inject('github.com');
    expect(document.getElementById(BUTTON_ID)).toBeNull();

    (globalThis.location as { pathname: string }).pathname = '/owner/repo/issues/5';
    history.pushState({}, '', '/owner/repo/issues/5');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it('removes button on pushState navigation away from target page', () => {
    (globalThis.location as { pathname: string }).pathname = '/owner/repo/pull/3';
    inject('github.com');
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();

    (globalThis.location as { pathname: string }).pathname = '/owner/repo';
    history.pushState({}, '', '/owner/repo');
    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it('reacts to popstate event', () => {
    (globalThis.location as { pathname: string }).pathname = '/owner/repo';
    inject('github.com');

    (globalThis.location as { pathname: string }).pathname = '/owner/repo/pull/2';
    globalThis.dispatchEvent(new Event('popstate'));
    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });
});
