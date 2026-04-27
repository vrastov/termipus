/**
 * Unit tests for background service worker.
 */

type BgMessage = { type: string; url?: string; data?: string; cols?: number; rows?: number };

class MockWebSocket {
  static readonly OPEN = 1;
  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  constructor(url: string) { this.url = url; }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

class MockPort {
  name = 'terminal';
  postMessage = jest.fn();
  onMessage = { addListener: jest.fn() };
  onDisconnect = { addListener: jest.fn() };

  _send(msg: BgMessage): void {
    this.onMessage.addListener.mock.calls.forEach(
      ([fn]: [(m: BgMessage) => void]) => fn(msg)
    );
  }
  _disconnect(): void {
    this.onDisconnect.addListener.mock.calls.forEach(
      ([fn]: [() => void]) => fn()
    );
  }
}

let connectListener: (port: MockPort) => void;

globalThis.chrome = {
  runtime: {
    onConnect: {
      addListener: jest.fn((fn: (port: MockPort) => void) => {
        connectListener = fn;
      }),
    },
  },
} as unknown as typeof chrome;

import { init } from './background';

describe('background', () => {
  let port: MockPort;
  let ws: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    init();
    port = new MockPort();
    connectListener(port);
  });

  test('init registers onConnect listener', () => {
    expect(chrome.runtime.onConnect.addListener).toHaveBeenCalled();
  });

  test('ignores ports with wrong name', () => {
    const other = new MockPort();
    other.name = 'other';
    connectListener(other);
    expect(other.onMessage.addListener).not.toHaveBeenCalled();
  });

  test('connect message opens WebSocket with correct URL', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://localhost/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe('ws://localhost/term');
  });

  test('WebSocket onopen posts open message', () => {
    port._send({ type: 'connect', url: 'ws://test/term' });
    // find the created WebSocket — patch constructor to capture
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    const created = instances[0];
    created.onopen?.();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'open' });
  });

  test('WebSocket onmessage posts data message', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    instances[0].onmessage?.({ data: 'hello' });
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'data', data: 'hello' });
  });

  test('WebSocket onerror posts error message', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    instances[0].onerror?.();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'error' });
  });

  test('WebSocket onclose posts close message', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    instances[0].onclose?.();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'close' });
  });

  test('send message forwards data to WebSocket', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    port._send({ type: 'send', data: 'hello' });
    expect(instances[0].send).toHaveBeenCalledWith('hello');
  });

  test('resize message sends JSON to WebSocket', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    port._send({ type: 'resize', cols: 120, rows: 30 });
    expect(instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'resize', cols: 120, rows: 30 })
    );
  });

  test('disconnect message closes WebSocket', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    port._send({ type: 'disconnect' });
    expect(instances[0].close).toHaveBeenCalled();
  });

  test('port disconnect closes WebSocket', () => {
    const instances: MockWebSocket[] = [];
    const OrigWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class extends MockWebSocket {
      constructor(url: string) { super(url); instances.push(this); }
    };
    port._send({ type: 'connect', url: 'ws://test/term' });
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    port._disconnect();
    expect(instances[0].close).toHaveBeenCalled();
  });
});
