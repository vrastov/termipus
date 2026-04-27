/**
 * Unit tests for TerminalSocket (chrome.runtime.connect-based).
 */

import { TerminalSocket } from './socket';

// --- Mock chrome ---

type PortMessage = { type: string; url?: string; data?: string; cols?: number; rows?: number };

class MockPort {
  name = 'terminal';
  postMessage = jest.fn();
  disconnect = jest.fn();
  onMessage = { addListener: jest.fn() };
  onDisconnect = { addListener: jest.fn() };

  /** Simulate a message arriving from background. */
  _receive(msg: PortMessage): void {
    const listeners: Array<(m: PortMessage) => void> = this.onMessage.addListener.mock.calls.map(
      (c: [unknown]) => c[0] as (m: PortMessage) => void
    );
    listeners.forEach((fn) => fn(msg));
  }

  /** Simulate port disconnect from background side. */
  _disconnect(): void {
    const listeners: Array<() => void> = this.onDisconnect.addListener.mock.calls.map(
      (c: [unknown]) => c[0] as () => void
    );
    listeners.forEach((fn) => fn());
  }
}

let mockPort: MockPort;

const mockSyncGet = jest.fn();
globalThis.chrome = {
  storage: { sync: { get: mockSyncGet } },
  runtime: {
    lastError: null,
    connect: jest.fn(() => {
      mockPort = new MockPort();
      return mockPort;
    }),
  },
} as unknown as typeof chrome;

describe('TerminalSocket', () => {
  let socket: TerminalSocket;
  const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis.chrome as unknown as { runtime: { lastError: null } }).runtime.lastError = null;
    mockSyncGet.mockImplementation((_: unknown, cb: (r: Record<string, unknown>) => void) => {
      cb({ serverUrl: 'ws://test/term' });
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    socket = new TerminalSocket(80, 24);
  });

  afterEach(() => {
    socket.disconnect();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('connects and sends connect message with URL', async () => {
    await socket.connect();
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'terminal' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'connect', url: 'ws://test/term' });
  });

  test('uses default URL if storage empty', async () => {
    mockSyncGet.mockImplementation((_: unknown, cb: (r: Record<string, unknown>) => void) => cb({}));
    await socket.connect();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'connect', url: 'ws://localhost:8080/terminal' });
  });

  test('sends init message on open', async () => {
    const onOpen = jest.fn();
    socket.setCallbacks({ onOpen });
    await socket.connect();
    mockPort._receive({ type: 'open' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: 'send',
      data: JSON.stringify({ type: 'init', cols: 80, rows: 24 }),
    });
    expect(onOpen).toHaveBeenCalled();
  });

  test('calls onData on data message', async () => {
    const onData = jest.fn();
    socket.setCallbacks({ onData });
    await socket.connect();
    mockPort._receive({ type: 'data', data: 'hello' });
    expect(onData).toHaveBeenCalledWith('hello');
  });

  test('ignores data message with no data field', async () => {
    const onData = jest.fn();
    socket.setCallbacks({ onData });
    await socket.connect();
    mockPort._receive({ type: 'data' });
    expect(onData).not.toHaveBeenCalled();
  });

  test('calls onError on error message', async () => {
    const onError = jest.fn();
    socket.setCallbacks({ onError });
    await socket.connect();
    mockPort._receive({ type: 'error' });
    expect(onError).toHaveBeenCalled();
  });

  test('calls onClose and schedules reconnect on close message', async () => {
    const onClose = jest.fn();
    socket.setCallbacks({ onClose });
    await socket.connect();
    jest.useFakeTimers();
    mockPort._receive({ type: 'close' });
    expect(onClose).toHaveBeenCalled();
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
  });

  test('does not reconnect after manual disconnect', async () => {
    await socket.connect();
    jest.useFakeTimers();
    socket.disconnect();
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('send posts message to port', async () => {
    await socket.connect();
    socket.send('data');
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'send', data: 'data' });
  });

  test('send is no-op when not connected', () => {
    socket.send('data');
    // no error
  });

  test('resize posts resize message', async () => {
    await socket.connect();
    socket.resize(120, 30);
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'resize', cols: 120, rows: 30 });
  });

  test('resize updates dimensions used in next init', async () => {
    await socket.connect();
    socket.resize(120, 30);
    socket.disconnect();
    await socket.connect();
    mockPort._receive({ type: 'open' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: 'send',
      data: JSON.stringify({ type: 'init', cols: 120, rows: 30 }),
    });
  });

  test('second connect while port open is no-op', async () => {
    await socket.connect();
    await socket.connect();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('reconnects on port disconnect from background', async () => {
    await socket.connect();
    jest.useFakeTimers();
    mockPort._disconnect();
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
  });

  test('does not reconnect on port disconnect after manual disconnect', async () => {
    await socket.connect();
    jest.useFakeTimers();
    socket.disconnect();
    mockPort._disconnect();
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('stops on Extension context invalidated', async () => {
    mockSyncGet.mockImplementation((_: unknown, cb: (r: Record<string, unknown>) => void) => {
      (globalThis.chrome as unknown as { runtime: { lastError: { message: string } } }).runtime.lastError = {
        message: 'Extension context invalidated.',
      };
      cb({});
    });
    await socket.connect();
    expect(chrome.runtime.connect).not.toHaveBeenCalled();
  });

  test('schedules reconnect on storage error', async () => {
    jest.useFakeTimers();
    mockSyncGet.mockImplementationOnce((_: unknown, cb: (r: Record<string, unknown>) => void) => {
      (globalThis.chrome as unknown as { runtime: { lastError: { message: string } | null } }).runtime.lastError = {
        message: 'Storage error',
      };
      cb({});
      (globalThis.chrome as unknown as { runtime: { lastError: null } }).runtime.lastError = null;
    });
    mockSyncGet.mockImplementationOnce((_: unknown, cb: (r: Record<string, unknown>) => void) => {
      cb({ serverUrl: 'ws://test/term' });
    });
    // connect() uses a real Promise internally — run microtasks manually
    const p = socket.connect();
    jest.runAllTicks();
    await p;
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('does not schedule duplicate reconnect timers', async () => {
    await socket.connect();
    jest.useFakeTimers();
    mockPort._receive({ type: 'close' });
    mockPort._receive({ type: 'close' });
    await jest.runAllTimersAsync();
    expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
  });
});
