export function init(): void {
  console.log('Termipus: background started');
  chrome.runtime.onConnect.addListener(handleConnect);
}

function handleConnect(port: chrome.runtime.Port): void {
  if (port.name !== 'terminal') {
    return;
  }

  let ws: WebSocket | null = null;

  function connect(url: string): void {
    ws = new WebSocket(url);

    ws.onopen = () => {
      port.postMessage({ type: 'open' });
    };

    ws.onmessage = (event) => {
      port.postMessage({ type: 'data', data: event.data });
    };

    ws.onerror = () => {
      port.postMessage({ type: 'error' });
    };

    ws.onclose = () => {
      ws = null;
      port.postMessage({ type: 'close' });
    };
  }

  port.onMessage.addListener((msg: { type: string; url?: string; data?: string; cols?: number; rows?: number }) => {
    if (msg.type === 'connect' && msg.url) {
      connect(msg.url);
    } else if (msg.type === 'send' && msg.data) {
      ws?.send(msg.data);
    } else if (msg.type === 'resize' && msg.cols !== undefined && msg.rows !== undefined) {
      ws?.send(JSON.stringify({ type: 'resize', cols: msg.cols, rows: msg.rows }));
    } else if (msg.type === 'disconnect') {
      ws?.close();
    }
  });

  port.onDisconnect.addListener(() => {
    ws?.close();
  });
}

init();
