import { init as initContent } from './content/index';
import { init as initBackground } from './background/background';

describe('background', () => {
  it('logs on init', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    initBackground();
    expect(spy).toHaveBeenCalledWith('Termipus: background started');
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
