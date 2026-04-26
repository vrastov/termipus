/**
 * @jest-environment jsdom
 */
import { createButton, cloneButtonStyle, setupSpaNavigation, makeInjectButton, makeRemoveButton, injectWithSpa, resetSpaState } from './inject-utils';

describe('inject-utils — createButton', () => {
  it('creates button with correct id, text and class', () => {
    const btn = createButton('test-id', 'btn btn-sm');
    expect(btn.id).toBe('test-id');
    expect(btn.textContent).toBe('⌨ Terminal');
    expect(btn.className).toBe('btn btn-sm');
  });
});

describe('inject-utils — setupSpaNavigation', () => {
  beforeEach(() => resetSpaState());
  afterEach(() => resetSpaState());

  it('calls run on pushState', () => {
    const run = jest.fn();
    setupSpaNavigation(run);
    history.pushState({}, '', '/test');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('calls run on popstate', () => {
    const run = jest.fn();
    setupSpaNavigation(run);
    globalThis.dispatchEvent(new Event('popstate'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — registers pushState patch only once', () => {
    const run1 = jest.fn();
    const run2 = jest.fn();
    setupSpaNavigation(run1);
    const patchedOnce = history.pushState;
    setupSpaNavigation(run2);
    expect(history.pushState).toBe(patchedOnce);
  });

  it('notifies all registered listeners on pushState', () => {
    const run1 = jest.fn();
    const run2 = jest.fn();
    setupSpaNavigation(run1);
    setupSpaNavigation(run2);
    history.pushState({}, '', '/test');
    expect(run1).toHaveBeenCalledTimes(1);
    expect(run2).toHaveBeenCalledTimes(1);
  });
});

describe('inject-utils — cloneButtonStyle', () => {
  it('does nothing when source is null', () => {
    const target = document.createElement('button');
    target.className = 'original';
    cloneButtonStyle(null, target);
    expect(target.className).toBe('original');
  });

  it('copies className from source', () => {
    const source = document.createElement('button');
    source.className = 'gl-button btn btn-md btn-default';
    const target = document.createElement('button');
    cloneButtonStyle(source, target);
    expect(target.className).toBe('gl-button btn btn-md btn-default');
  });

  it('copies data-* attributes from source', () => {
    const source = document.createElement('button');
    source.setAttribute('data-size', 'medium');
    source.setAttribute('data-variant', 'default');
    const target = document.createElement('button');
    cloneButtonStyle(source, target);
    expect(target.getAttribute('data-size')).toBe('medium');
    expect(target.getAttribute('data-variant')).toBe('default');
  });

  it('does not copy non-data-* attributes', () => {
    const source = document.createElement('button');
    source.setAttribute('aria-label', 'some label');
    const target = document.createElement('button');
    cloneButtonStyle(source, target);
    expect(target.getAttribute('aria-label')).toBeNull();
  });
});

describe('inject-utils — makeInjectButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing when toolbar not found', () => {
    const inject = makeInjectButton('btn-id', '.missing', 'cls');
    inject();
    expect(document.getElementById('btn-id')).toBeNull();
  });

  it('injects button into toolbar', () => {
    document.body.innerHTML = '<div class="toolbar"></div>';
    const inject = makeInjectButton('btn-id', '.toolbar', 'cls');
    inject();
    const btn = document.getElementById('btn-id');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('⌨ Terminal');
  });

  it('does not inject duplicate button', () => {
    document.body.innerHTML = '<div class="toolbar"></div>';
    const inject = makeInjectButton('btn-id', '.toolbar', 'cls');
    inject();
    inject();
    expect(document.querySelectorAll('#btn-id').length).toBe(1);
  });

  it('clones style from first toolbar button when present', () => {
    document.body.innerHTML = `
      <div class="toolbar">
        <button class="gl-button btn-md" data-size="medium" data-variant="default">Existing</button>
      </div>`;
    const inject = makeInjectButton('btn-id', '.toolbar', 'fallback-cls');
    inject();
    const btn = document.getElementById('btn-id') as HTMLButtonElement;
    expect(btn.className).toBe('gl-button btn-md');
    expect(btn.getAttribute('data-size')).toBe('medium');
    expect(btn.getAttribute('data-variant')).toBe('default');
  });

  it('falls back to className when toolbar has no buttons', () => {
    document.body.innerHTML = '<div class="toolbar"></div>';
    const inject = makeInjectButton('btn-id', '.toolbar', 'fallback-cls');
    inject();
    const btn = document.getElementById('btn-id') as HTMLButtonElement;
    expect(btn.className).toBe('fallback-cls');
  });
});

describe('inject-utils — makeRemoveButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes existing button', () => {
    document.body.innerHTML = '<button id="btn-id"></button>';
    const remove = makeRemoveButton('btn-id');
    remove();
    expect(document.getElementById('btn-id')).toBeNull();
  });

  it('does nothing when button absent', () => {
    const remove = makeRemoveButton('btn-id');
    expect(() => remove()).not.toThrow();
  });
});

describe('inject-utils — injectWithSpa', () => {
  let origLocation: Location;
  const injectButton = jest.fn();
  const removeButton = jest.fn();
  const isTargetPage = jest.fn();

  beforeEach(() => {
    resetSpaState();
    origLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      value: { pathname: '/' },
      writable: true,
      configurable: true,
    });
    injectButton.mockReset();
    removeButton.mockReset();
    isTargetPage.mockReset();
  });

  afterEach(() => {
    resetSpaState();
    Object.defineProperty(globalThis, 'location', {
      value: origLocation,
      writable: true,
      configurable: true,
    });
  });

  it('does nothing on non-matching hostname', () => {
    injectWithSpa({ hostname: 'other.com', hostMatch: 'example.com', isTargetPage, injectButton, removeButton });
    expect(injectButton).not.toHaveBeenCalled();
    expect(removeButton).not.toHaveBeenCalled();
  });

  it('calls injectButton on target page', () => {
    isTargetPage.mockReturnValue(true);
    injectWithSpa({ hostname: 'example.com', hostMatch: 'example.com', isTargetPage, injectButton, removeButton });
    expect(injectButton).toHaveBeenCalledTimes(1);
  });

  it('calls removeButton on non-target page', () => {
    isTargetPage.mockReturnValue(false);
    injectWithSpa({ hostname: 'example.com', hostMatch: 'example.com', isTargetPage, injectButton, removeButton });
    expect(removeButton).toHaveBeenCalledTimes(1);
  });

  it('reacts to pushState navigation', () => {
    isTargetPage.mockReturnValueOnce(false).mockReturnValueOnce(true);
    injectWithSpa({ hostname: 'example.com', hostMatch: 'example.com', isTargetPage, injectButton, removeButton });
    history.pushState({}, '', '/new');
    expect(injectButton).toHaveBeenCalledTimes(1);
  });
});
