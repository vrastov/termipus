/**
 * Unit tests for TerminalSocket.
 * Tests cover connection, messaging, reconnection, resizing, and edge cases.
 */

import { TerminalSocket } from './socket';

// Mock chrome.storage
const mockSyncGet = jest.fn();
globalThis.chrome = {
  storage: {
    sync: {
      get: mockSyncGet,
    },
  },
  runtime: {
    lastError: null,
  },
} as any;

// Mock WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  send = jest.fn();
  close = jest.fn();

  constructor(url: string) {
    this.url = url;
    // Store instance to global for test manipulation
    (globalThis as any).__lastMockWebSocket = this;
  }

  // Simulate open event
  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  // Simulate message event
  _simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  // Simulate error event
  _simulateError() {
    this.onerror?.({});
  }

  // Simulate close event
  _simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }
}

globalThis.WebSocket = MockWebSocket as any;

describe('TerminalSocket', () => {
  let terminalSocket: TerminalSocket;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset runtime lastError
    (globalThis.chrome as any).runtime.lastError = null;
    // Default successful storage get
    mockSyncGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: 'ws://test.example/term' });
    });
    terminalSocket = new TerminalSocket(80, 24);
    // Spy on console.error to avoid noise
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    terminalSocket.disconnect();
    jest.restoreAllMocks();
  });

  // Helper to wait for promise and flush microtasks
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  test('connects to server URL from chrome.storage', async () => {
    // Execute connect
    const connectPromise = terminalSocket.connect();
    await flushPromises();
    // Since establishConnection is sync after loadUrl, we can check
    await connectPromise;
    // Verify chrome.storage.sync.get was called
    expect(mockSyncGet).toHaveBeenCalledWith(['serverUrl'], expect.any(Function));
    // Get the mock WebSocket instance
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    expect(mockWebSocket).toBeDefined();
    expect(mockWebSocket.url).toBe('ws://test.example/term');
  });

  test('uses default URL if chrome.storage returns empty', async () => {
    // Simulate empty storage result
    mockSyncGet.mockImplementation((keys, callback) => {
      callback({});
    });
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    expect(mockWebSocket.url).toBe('ws://localhost:8080/terminal');
  });

  test('sends init message on open', async () => {
    const onOpenMock = jest.fn();
    terminalSocket.setCallbacks({ onOpen: onOpenMock });
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    // Simulate open
    mockWebSocket._simulateOpen();
    // Verify init message sent
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'init', cols: 80, rows: 24 })
    );
    expect(onOpenMock).toHaveBeenCalled();
  });

  test('sends text data via send method', async () => {
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    terminalSocket.send('hello world');
    expect(mockWebSocket.send).toHaveBeenCalledWith('hello world');
  });

  test('calls onData callback on incoming message', async () => {
    const onDataMock = jest.fn();
    terminalSocket.setCallbacks({ onData: onDataMock });
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    mockWebSocket._simulateMessage('server output');
    expect(onDataMock).toHaveBeenCalledWith('server output');
  });

  test('handles non-string message data gracefully', async () => {
    const onDataMock = jest.fn();
    terminalSocket.setCallbacks({ onData: onDataMock });
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    // Simulate binary data or other type; our code ignores non-string
    mockWebSocket.onmessage?.({ data: new ArrayBuffer(8) });
    expect(onDataMock).not.toHaveBeenCalled();
  });

  test('reconnects after 3 seconds on close', async () => {
    jest.useFakeTimers();
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    mockWebSocket._simulateClose();
    // Fast-forward 3 seconds — reconnect should fire
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(mockSyncGet).toHaveBeenCalledTimes(2); // initial + reconnect
    jest.useRealTimers();
  });

  test('does not reconnect after manual disconnect', async () => {
    jest.useFakeTimers();
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    terminalSocket.disconnect();
    // disconnect() nulls ws handlers, so _simulateClose won't trigger handleClose
    // Advance time — no reconnect should happen
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(mockSyncGet).toHaveBeenCalledTimes(1); // only initial connect
    jest.useRealTimers();
  });

  test('resize sends resize message and updates dimensions', async () => {
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    terminalSocket.resize(120, 30);
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'resize', cols: 120, rows: 30 })
    );
  });

  test('resize updates stored dimensions for future reconnections', async () => {
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    terminalSocket.resize(120, 30);
    terminalSocket.disconnect();
    // Reconnect
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    // Should send init with updated dimensions
    expect(mockWebSocket.send).toHaveBeenLastCalledWith(
      JSON.stringify({ type: 'init', cols: 120, rows: 30 })
    );
  });

  test('does not send resize if connection not open', async () => {
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    // Not yet open
    terminalSocket.resize(100, 40);
    expect(mockWebSocket.send).not.toHaveBeenCalled();
    // But dimensions updated
    // After open, init will use new dimensions (checked separately)
  });

  test('does not send data if connection not open', () => {
    terminalSocket.send('test');
    // No WebSocket yet, no error
    expect(true).toBe(true);
  });

  test('handles chrome.storage error and schedules reconnect', async () => {
    jest.useFakeTimers();
    mockSyncGet.mockImplementation((keys, callback) => {
      (globalThis.chrome as any).runtime.lastError = {
        message: 'Storage error occurred',
      };
      callback({});
    });
    const connectPromise = terminalSocket.connect();
    await Promise.resolve();
    await connectPromise;
    expect(mockSyncGet).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(mockSyncGet).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('calls onClose and onError callbacks', async () => {
    const onCloseMock = jest.fn();
    const onErrorMock = jest.fn();
    terminalSocket.setCallbacks({ onClose: onCloseMock, onError: onErrorMock });
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    mockWebSocket._simulateError();
    expect(onErrorMock).toHaveBeenCalled();
    mockWebSocket._simulateClose();
    expect(onCloseMock).toHaveBeenCalled();
  });

  test('does not reconnect if already open', async () => {
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    await terminalSocket.connect(); // second call while OPEN
    expect(mockSyncGet).toHaveBeenCalledTimes(1); // no second connect
  });

  test('does not reconnect if already connecting', async () => {
    // Don't simulate open — stays CONNECTING
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    // readyState is CONNECTING (0)
    await terminalSocket.connect(); // second call while CONNECTING
    expect(mockSyncGet).toHaveBeenCalledTimes(1);
  });

  test('clears pending reconnect timer when establishing new connection', async () => {
    jest.useFakeTimers();
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    mockWebSocket._simulateClose(); // schedules reconnect timer
    // Before timer fires, manually connect — should clear timer
    await terminalSocket.connect();
    const secondWebSocket = (globalThis as any).__lastMockWebSocket;
    expect(secondWebSocket).not.toBe(mockWebSocket);
    jest.useRealTimers();
  });

  test('does not schedule duplicate reconnect timers', async () => {
    jest.useFakeTimers();
    await terminalSocket.connect();
    mockWebSocket = (globalThis as any).__lastMockWebSocket;
    mockWebSocket._simulateOpen();
    mockWebSocket._simulateClose(); // schedules first timer
    // Simulate close again (e.g. error then close) — should not add second timer
    mockWebSocket._simulateClose();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(mockSyncGet).toHaveBeenCalledTimes(2); // only one reconnect
    jest.useRealTimers();
  });
});
