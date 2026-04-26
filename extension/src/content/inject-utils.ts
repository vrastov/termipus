let originalPushState: typeof history.pushState | null = null;
let spaInitialized = false;
const spaListeners: Array<() => void> = [];

/** @internal только для тестов */
export function resetSpaState(): void {
  if (originalPushState !== null) {
    history.pushState = originalPushState;
  }
  originalPushState = null;
  spaInitialized = false;
  spaListeners.length = 0;
}

function onPushState(...args: Parameters<typeof history.pushState>): void {
  originalPushState!(...args);
  spaListeners.forEach((fn) => fn());
}

function onPopState(): void {
  spaListeners.forEach((fn) => fn());
}

export function setupSpaNavigation(run: () => void): void {
  spaListeners.push(run);
  if (!spaInitialized) {
    originalPushState = history.pushState.bind(history);
    history.pushState = onPushState;
    globalThis.addEventListener('popstate', onPopState);
    spaInitialized = true;
  }
}

export function createButton(id: string, className: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = '⌨ Terminal';
  btn.className = className;
  return btn;
}

/**
 * Copies className and data-* attributes from {@code source} to {@code target}.
 * No-op if {@code source} is null.
 */
export function cloneButtonStyle(source: Element | null, target: HTMLElement): void {
  if (!source) {
    return;
  }
  target.className = source.className;
  for (const attr of Array.from(source.attributes)) {
    if (attr.name.startsWith('data-')) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

export function makeInjectButton(buttonId: string, toolbarSelector: string, className: string): () => void {
  return (): void => {
    if (document.getElementById(buttonId)) {
      return;
    }
    const toolbar = document.querySelector(toolbarSelector);
    if (!toolbar) {
      return;
    }
    const btn = createButton(buttonId, className);
    cloneButtonStyle(toolbar.querySelector('button'), btn);
    toolbar.appendChild(btn);
  };
}

export function makeRemoveButton(buttonId: string): () => void {
  return (): void => {
    document.getElementById(buttonId)?.remove();
  };
}

export interface InjectConfig {
  hostname: string;
  hostMatch: string;
  isTargetPage: (path: string) => boolean;
  injectButton: () => void;
  removeButton: () => void;
}

export function injectWithSpa(config: InjectConfig): void {
  if (!config.hostname.includes(config.hostMatch)) {
    return;
  }
  const run = (): void => {
    if (config.isTargetPage(globalThis.location?.pathname ?? '')) {
      config.injectButton();
    } else {
      config.removeButton();
    }
  };
  run();
  setupSpaNavigation(run);
}
