/**
 * @jest-environment jsdom
 */

jest.mock('./terminal/panel', () => ({
  TerminalPanel: jest.fn().mockImplementation(() => ({ attach: jest.fn() })),
}));

globalThis.chrome = {
  runtime: {
    onConnect: { addListener: jest.fn() },
  },
  storage: { sync: { get: jest.fn() } },
} as unknown as typeof chrome;

import { init as initContent } from './content/index';
import { init as initBackground } from './background/background';

describe('background', () => {
  it('logs on init and registers onConnect listener', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    initBackground();
    expect(spy).toHaveBeenCalledWith('Termipus: background started');
    expect(chrome.runtime.onConnect.addListener).toHaveBeenCalled();
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
