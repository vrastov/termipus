import { injectWithSpa, makeInjectButton, makeRemoveButton } from '../inject-utils';

const BUTTON_ID = 'termipus-btn-gitlab';
const TOOLBAR = '.js-issuable-actions';

// MR: /-/merge_requests/123, Issue: /-/issues/123
export function isTargetPage(path: string): boolean {
  return /\/-\/(merge_requests|issues)\/\d+/.test(path);
}

export const injectButton = makeInjectButton(BUTTON_ID, TOOLBAR, 'btn btn-default btn-sm');
export const removeButton = makeRemoveButton(BUTTON_ID);

export function inject(hostname: string): void {
  injectWithSpa({ hostname, hostMatch: 'gitlab.com', isTargetPage, injectButton, removeButton });
}
