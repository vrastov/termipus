import { injectWithSpa, makeInjectButton, makeRemoveButton } from '../inject-utils';

const BUTTON_ID = 'termipus-btn-github';
const TOOLBAR = '[data-component="PH_Actions"]';

// PR: /owner/repo/pull/123, Issue: /owner/repo/issues/123
export function isTargetPage(path: string): boolean {
  return /\/[^/]+\/[^/]+\/(pull|issues)\/\d+/.test(path);
}

export const injectButton = makeInjectButton(BUTTON_ID, TOOLBAR, 'btn btn-sm');
export const removeButton = makeRemoveButton(BUTTON_ID);

export function inject(hostname: string): void {
  injectWithSpa({ hostname, hostMatch: 'github.com', isTargetPage, injectButton, removeButton });
}
