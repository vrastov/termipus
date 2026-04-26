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
