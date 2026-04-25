/**
 * WebSocket client for terminal communication.
 * Handles connection, reconnection, resizing, and message passing.
 */

export type TerminalSocketCallbacks = {
  onOpen?: () => void;
  onData?: (data: string) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
};

export class TerminalSocket {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectTimer: number | null = null;
  private manuallyClosed: boolean = false;
  private cols: number;
  private rows: number;
  private callbacks: TerminalSocketCallbacks = {};

  constructor(cols: number = 80, rows: number = 24) {
    this.cols = cols;
    this.rows = rows;
  }

  /**
   * Set callbacks for socket events.
   */
  public setCallbacks(callbacks: TerminalSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to the WebSocket server using URL from chrome.storage.
   * If already connected or connecting, does nothing.
   */
  public async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }
    this.manuallyClosed = false;
    try {
      this.url = await this.loadUrl();
      this.establishConnection();
    } catch (error) {
      console.error('Failed to load WebSocket URL:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Load server URL from chrome.storage.sync.
   * Default: 'ws://localhost:8080/terminal'
   */
  private loadUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get(['serverUrl'], (result) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            const url = result.serverUrl || 'ws://localhost:8080/terminal';
            resolve(url);
          }
        });
      } else {
        // Fallback for non-extension environment (tests)
        resolve('ws://localhost:8080/terminal');
      }
    });
  }

  /**
   * Create WebSocket connection and set up event handlers.
   */
  private establishConnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws = new WebSocket(this.url);
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  /**
   * Handle WebSocket open event.
   * Sends init message with current terminal dimensions.
   */
  private handleOpen(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const initMessage = JSON.stringify({
        type: 'init',
        cols: this.cols,
        rows: this.rows,
      });
      this.ws.send(initMessage);
      this.callbacks.onOpen?.();
    }
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(event: MessageEvent): void {
    const data = typeof event.data === 'string' ? event.data : '';
    if (data) {
      this.callbacks.onData?.(data);
    }
  }

  /**
   * Handle WebSocket close event.
   * Schedules reconnect unless manually closed.
   */
  private handleClose(): void {
    this.ws = null;
    this.callbacks.onClose?.();
    if (!this.manuallyClosed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event.
   */
  private handleError(event: Event): void {
    this.callbacks.onError?.(event);
    // No immediate reconnect; close will follow
  }

  /**
   * Schedule a reconnection attempt after 3 seconds.
   */
  private scheduleReconnect(): void {
    if (this.manuallyClosed) {
      return;
    }
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  /**
   * Send data through the WebSocket.
   * If connection is not open, data is silently dropped (no buffering).
   */
  public send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Resize terminal and notify server.
   * Stores new dimensions for future reconnections.
   */
  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    if (this.ws?.readyState === WebSocket.OPEN) {
      const resizeMessage = JSON.stringify({
        type: 'resize',
        cols: this.cols,
        rows: this.rows,
      });
      this.ws.send(resizeMessage);
    }
  }

  /**
   * Manually disconnect and prevent automatic reconnection.
   */
  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Remove event handlers to avoid further callbacks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
