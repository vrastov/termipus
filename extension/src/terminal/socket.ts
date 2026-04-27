/**
 * WebSocket client for terminal communication.
 * Delegates WebSocket connection to background service worker via chrome.runtime.connect
 * to bypass page CSP restrictions on GitLab/GitHub.
 */

export type TerminalSocketCallbacks = {
  onOpen?: () => void;
  onData?: (data: string) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
};

export class TerminalSocket {
  private port: chrome.runtime.Port | null = null;
  private reconnectTimer: number | null = null;
  private manuallyClosed: boolean = false;
  private cols: number;
  private rows: number;
  private callbacks: TerminalSocketCallbacks = {};

  constructor(cols: number = 80, rows: number = 24) {
    this.cols = cols;
    this.rows = rows;
  }

  /** Set callbacks for socket events. */
  public setCallbacks(callbacks: TerminalSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /** Connect to the WebSocket server via background service worker. */
  public async connect(): Promise<void> {
    if (this.port) {
      return;
    }
    this.manuallyClosed = false;
    try {
      const url = await this.loadUrl();
      this.establishConnection(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Extension context invalidated')) {
        return;
      }
      console.error('Failed to load WebSocket URL:', error);
      this.scheduleReconnect();
    }
  }

  /** Load server URL from chrome.storage.sync. */
  private loadUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get(['serverUrl'], (result) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve((result.serverUrl as string | undefined) || 'ws://localhost:8080/terminal');
          }
        });
      } else {
        resolve('ws://localhost:8080/terminal');
      }
    });
  }

  private establishConnection(url: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.port = chrome.runtime.connect({ name: 'terminal' });

    this.port.onMessage.addListener((msg: { type: string; data?: string }) => {
      if (msg.type === 'open') {
        this.port?.postMessage({
          type: 'send',
          data: JSON.stringify({ type: 'init', cols: this.cols, rows: this.rows }),
        });
        this.callbacks.onOpen?.();
      } else if (msg.type === 'data') {
        if (msg.data) {
          this.callbacks.onData?.(msg.data);
        }
      } else if (msg.type === 'error') {
        this.callbacks.onError?.(new Event('error'));
      } else if (msg.type === 'close') {
        this.port = null;
        this.callbacks.onClose?.();
        if (!this.manuallyClosed) {
          this.scheduleReconnect();
        }
      }
    });

    this.port.onDisconnect.addListener(() => {
      this.port = null;
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.port.postMessage({ type: 'connect', url });
  }

  /** Send data through the WebSocket. */
  public send(data: string): void {
    this.port?.postMessage({ type: 'send', data });
  }

  /** Resize terminal and notify server. */
  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.port?.postMessage({ type: 'resize', cols, rows });
  }

  /** Manually disconnect and prevent automatic reconnection. */
  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      this.port.postMessage({ type: 'disconnect' });
      this.port.disconnect();
      this.port = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 3000);
  }
}
