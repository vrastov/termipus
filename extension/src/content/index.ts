import { inject as injectGitHub } from './github/inject';
import { inject as injectGitLab } from './gitlab/inject';
import { TerminalPanel } from '../terminal/panel';

export function init(hostname: string): void {
  console.log('Termipus: content script loaded', hostname);
  injectGitHub(hostname);
  injectGitLab(hostname);
  const panel = new TerminalPanel();
  panel.attach(['termipus-btn-github', 'termipus-btn-gitlab']);
}

init(globalThis.location?.hostname ?? '');
