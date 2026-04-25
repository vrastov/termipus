import { inject as injectGitHub } from './content/github/inject';
import { inject as injectGitLab } from './content/gitlab/inject';
import { init as initContent } from './content/index';
import { init as initBackground } from './background/background';
import { init as initPopup } from './popup/popup';

describe('background', () => {
  it('logs on init', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    initBackground();
    expect(spy).toHaveBeenCalledWith('Termipus: background started');
    spy.mockRestore();
  });
});

describe('popup', () => {
  it('logs on init', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    initPopup();
    expect(spy).toHaveBeenCalledWith('Termipus: popup loaded');
    spy.mockRestore();
  });
});

describe('content/index', () => {
  it('logs hostname', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    initContent('gitlab.com');
    expect(spy).toHaveBeenCalledWith('Termipus: content script loaded', 'gitlab.com');
    spy.mockRestore();
  });
});

describe('github/inject', () => {
  it('logs on github.com', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    injectGitHub('github.com');
    expect(spy).toHaveBeenCalledWith('Termipus: initializing GitHub integration');
    spy.mockRestore();
  });

  it('does nothing on other hostname', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    injectGitHub('gitlab.com');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('gitlab/inject', () => {
  it('logs on gitlab.com', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    injectGitLab('gitlab.com');
    expect(spy).toHaveBeenCalledWith('Termipus: initializing GitLab integration');
    spy.mockRestore();
  });

  it('does nothing on other hostname', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    injectGitLab('github.com');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
