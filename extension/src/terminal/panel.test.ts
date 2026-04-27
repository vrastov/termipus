/**
 * @jest-environment jsdom
 */
/**
 * Unit tests for TerminalPanel.
 */

// --- Mocks ---

const mockTerminalWrite = jest.fn();
const mockTerminalWriteln = jest.fn();
const mockTerminalOpen = jest.fn();
const mockTerminalLoadAddon = jest.fn();
const mockTerminalOnData = jest.fn();
let mockTerminalCols = 80;
let mockTerminalRows = 24;

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    open: mockTerminalOpen,
    write: mockTerminalWrite,
    writeln: mockTerminalWriteln,
    loadAddon: mockTerminalLoadAddon,
    onData: mockTerminalOnData,
    get cols() { return mockTerminalCols; },
    get rows() { return mockTerminalRows; },
  })),
}));

const mockFitAddonFit = jest.fn();
jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: mockFitAddonFit,
  })),
}));

const mockSocketConnect = jest.fn().mockResolvedValue(undefined);
const mockSocketDisconnect = jest.fn();
const mockSocketSend = jest.fn();
const mockSocketResize = jest.fn();
const mockSocketSetCallbacks = jest.fn();

jest.mock('./socket', () => ({
  TerminalSocket: jest.fn().mockImplementation(() => ({
    connect: mockSocketConnect,
    disconnect: mockSocketDisconnect,
    send: mockSocketSend,
    resize: mockSocketResize,
    setCallbacks: mockSocketSetCallbacks,
  })),
}));

// Mock ResizeObserver
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  static instances: MockResizeObserver[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();

  _trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// --- Tests ---

import { TerminalPanel } from './panel';
import { TerminalSocket } from './socket';

describe('TerminalPanel', () => {
  let panel: TerminalPanel;
  let socket: TerminalSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    MockResizeObserver.instances = [];
    mockTerminalCols = 80;
    mockTerminalRows = 24;
    document.body.innerHTML = '';
    socket = new TerminalSocket();
    panel = new TerminalPanel(socket);
  });

  afterEach(() => {
    panel.close();
  });

  // --- attach ---

  test('attach: click on button calls open()', () => {
    const btn = document.createElement('button');
    btn.id = 'termipus-btn-gitlab';
    document.body.appendChild(btn);

    panel.attach(['termipus-btn-gitlab']);
    btn.click();

    expect(document.getElementById('termipus-panel')).not.toBeNull();
  });

  test('attach: works even if button is added after attach() call', () => {
    panel.attach(['termipus-btn-github']);

    // Button added after attach
    const btn = document.createElement('button');
    btn.id = 'termipus-btn-github';
    document.body.appendChild(btn);
    btn.click();

    expect(document.getElementById('termipus-panel')).not.toBeNull();
  });

  test('attach: ignores clicks on unrelated elements', () => {
    panel.attach(['termipus-btn-gitlab']);

    const other = document.createElement('button');
    other.id = 'some-other-btn';
    document.body.appendChild(other);
    other.click();

    expect(document.getElementById('termipus-panel')).toBeNull();
  });

  // --- open ---

  test('open: creates panel in DOM', () => {
    panel.open();
    expect(document.getElementById('termipus-panel')).not.toBeNull();
  });

  test('open: opens xterm Terminal in termipus-xterm element', () => {
    panel.open();
    expect(mockTerminalOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'termipus-xterm' })
    );
  });

  test('open: calls fitAddon.fit()', () => {
    panel.open();
    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  test('open: calls socket.connect()', () => {
    panel.open();
    expect(mockSocketConnect).toHaveBeenCalled();
  });

  test('open: sets up ResizeObserver on container', () => {
    panel.open();
    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0].observe).toHaveBeenCalledWith(
      document.getElementById('termipus-panel')
    );
  });

  test('open: second call is no-op (panel already exists)', () => {
    panel.open();
    panel.open();
    expect(document.querySelectorAll('#termipus-panel')).toHaveLength(1);
    expect(mockSocketConnect).toHaveBeenCalledTimes(1);
  });

  // --- close ---

  test('close: removes panel from DOM', () => {
    panel.open();
    panel.close();
    expect(document.getElementById('termipus-panel')).toBeNull();
  });

  test('close: calls socket.disconnect()', () => {
    panel.open();
    panel.close();
    expect(mockSocketDisconnect).toHaveBeenCalled();
  });

  test('close: disconnects ResizeObserver', () => {
    panel.open();
    const observer = MockResizeObserver.instances[0];
    panel.close();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  test('close: without open is safe', () => {
    expect(() => panel.close()).not.toThrow();
  });

  test('close button click closes panel', () => {
    panel.open();
    const closeBtn = document.getElementById('termipus-panel-close') as HTMLButtonElement;
    closeBtn.click();
    expect(document.getElementById('termipus-panel')).toBeNull();
  });

  // --- socket callbacks ---

  test('socket onData writes to terminal', () => {
    panel.open();
    const callbacks = mockSocketSetCallbacks.mock.calls[0][0];
    callbacks.onData('hello');
    expect(mockTerminalWrite).toHaveBeenCalledWith('hello');
  });

  test('socket onError writes error message to terminal', () => {
    panel.open();
    const callbacks = mockSocketSetCallbacks.mock.calls[0][0];
    callbacks.onError();
    expect(mockTerminalWriteln).toHaveBeenCalledWith(
      expect.stringContaining('недоступен')
    );
  });

  test('socket onClose writes close message to terminal', () => {
    panel.open();
    const callbacks = mockSocketSetCallbacks.mock.calls[0][0];
    callbacks.onClose();
    expect(mockTerminalWriteln).toHaveBeenCalledWith(
      expect.stringContaining('закрыто')
    );
  });

  test('terminal onData sends to socket', () => {
    panel.open();
    // onData registers a handler; simulate it being called
    const handler = mockTerminalOnData.mock.calls[0][0] as (data: string) => void;
    handler('user input');
    expect(mockSocketSend).toHaveBeenCalledWith('user input');
  });

  // --- resize ---

  test('ResizeObserver trigger calls fitAddon.fit() and socket.resize()', () => {
    panel.open();
    mockTerminalCols = 120;
    mockTerminalRows = 30;
    MockResizeObserver.instances[0]._trigger();
    expect(mockFitAddonFit).toHaveBeenCalledTimes(2); // once on open, once on resize
    expect(mockSocketResize).toHaveBeenCalledWith(120, 30);
  });

  // --- default socket ---

  test('creates default TerminalSocket if none provided', () => {
    const defaultPanel = new TerminalPanel();
    expect(TerminalSocket).toHaveBeenCalled();
    defaultPanel.close();
  });
});
