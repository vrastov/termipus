export function init(hostname: string): void {
  console.log('Termipus: content script loaded', hostname);
}

import { inject as injectGitHub } from './github/inject';
import { inject as injectGitLab } from './gitlab/inject';

const hostname = globalThis.location?.hostname ?? '';
init(hostname);
injectGitHub(hostname);
injectGitLab(hostname);
