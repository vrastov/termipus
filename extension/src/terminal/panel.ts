import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSocket } from './socket';

const PANEL_ID = 'termipus-panel';
const CLOSE_BTN_ID = 'termipus-panel-close';

export class TerminalPanel {
  private readonly terminal: Terminal;
  private readonly fitAddon: FitAddon;
  private readonly socket: TerminalSocket;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(socket?: TerminalSocket) {
    this.terminal = new Terminal({ convertEol: true });
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.socket = socket ?? new TerminalSocket();
  }

  /** Attach click listeners to Terminal buttons via event delegation. */
  public attach(buttonIds: string[]): void {
    console.log('Termipus: registering panel for buttons', buttonIds);
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (buttonIds.includes(target.id)) {
        console.log(`Termipus: button #${target.id} clicked, opening panel`);
        this.open();
      }
    });
  }

  /** Open the terminal panel. */
  public open(): void {
    if (document.getElementById(PANEL_ID)) {
      console.log('Termipus: panel already open');
      return;
    }
    console.log('Termipus: opening terminal panel');

    this.container = this.buildContainer();
    document.body.appendChild(this.container);

    const termEl = this.container.querySelector<HTMLElement>('#termipus-xterm');
    if (termEl) {
      this.terminal.open(termEl);
      this.fitAddon.fit();
    }

    this.setupSocket();
    this.setupResizeObserver();
  }

  /** Close the terminal panel and disconnect. */
  public close(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.socket.disconnect();
    this.container?.remove();
    this.container = null;
  }

  private buildContainer(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;height:300px;background:#1e1e1e;z-index:99999;display:flex;flex-direction:column;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:flex-end;padding:2px 4px;background:#333;';

    const closeBtn = document.createElement('button');
    closeBtn.id = CLOSE_BTN_ID;
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#ccc;cursor:pointer;font-size:14px;';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(closeBtn);

    const termEl = document.createElement('div');
    termEl.id = 'termipus-xterm';
    termEl.style.cssText = 'flex:1;overflow:hidden;';

    panel.appendChild(header);
    panel.appendChild(termEl);
    return panel;
  }

  private setupSocket(): void {
    this.socket.setCallbacks({
      onData: (data) => this.terminal.write(data),
      onError: () => this.terminal.writeln('\r\n\x1b[31mСервер недоступен. Переподключение...\x1b[0m'),
      onClose: () => this.terminal.writeln('\r\n\x1b[33mСоединение закрыто.\x1b[0m'),
    });

    this.terminal.onData((data) => this.socket.send(data));

    void this.socket.connect();
  }

  private setupResizeObserver(): void {
    if (!this.container) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
      const { cols, rows } = this.terminal;
      this.socket.resize(cols, rows);
    });
    this.resizeObserver.observe(this.container);
  }
}
