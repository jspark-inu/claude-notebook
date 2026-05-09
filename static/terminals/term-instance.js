// xterm 인스턴스 + WebSocket transport + resize.
// 5b 에서 input bar/upload/vkb, 5c 에서 chat mode/config 흡수 예정.

const BASE = window.__VIEWER_BASE || '';
const JUPYTER = window.__JUPYTER_BASE !== undefined ? window.__JUPYTER_BASE : BASE;
const WS_BASE = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;

export class TerminalInstance {
  constructor({ name }) {
    this.name = name;
    this.xterm = null;
    this.fitAddon = null;
    this.webLinksAddon = null;
    this.socket = null;
    this.dom = null;
    this.disposed = false;
    this._ro = null;
    this._resizeTimer = null;
  }

  mount(hostEl) {
    if (this.disposed) throw new Error('disposed');
    this.dom = hostEl;

    // Original options from createXterm() in terminal.js
    this.xterm = new window.Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'SFMono-Regular', 'Fira Code', 'Consolas', 'Courier New', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
      },
      scrollback: 10000,
      smoothScrollDuration: 0,
      allowProposedApi: true,
    });

    this.fitAddon = new window.FitAddon.FitAddon();
    this.webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
    this.xterm.loadAddon(this.fitAddon);
    this.xterm.loadAddon(this.webLinksAddon);
    this.xterm.open(hostEl);

    setTimeout(() => {
      this.fitAddon?.fit();
    }, 50);

    this._connect();
    this._attachResize();
  }

  fit() { this.fitAddon?.fit(); }

  _connect() {
    const url = `${WS_BASE}${JUPYTER}/terminals/websocket/${this.name}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      const dims = this.fitAddon?.proposeDimensions();
      if (dims && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(['set_size', dims.rows, dims.cols]));
      }
    };

    this.socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg[0] === 'stdout') {
          this.xterm.write(msg[1]);
        }
        // 'disconnect' message handling is done in terminal.js via currentWs.onmessage override
      } catch (_) {}
    };

    this.xterm.onData((d) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(['stdin', d]));
      }
    });
  }

  _attachResize() {
    let lastW = 0, lastH = 0;
    this._ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;

      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this.fitAddon || !this.xterm) return;
        const viewport = this.dom?.querySelector('.xterm-viewport');
        const wasAtBottom = viewport
          ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 30
          : true;
        const savedTop = viewport ? viewport.scrollTop : 0;

        this.fitAddon.fit();

        if (viewport) {
          requestAnimationFrame(() => {
            viewport.scrollTop = wasAtBottom
              ? viewport.scrollHeight
              : Math.min(savedTop, viewport.scrollHeight - viewport.clientHeight);
          });
        }

        if (this.socket?.readyState === WebSocket.OPEN) {
          const dims = this.fitAddon.proposeDimensions();
          if (dims) {
            this.socket.send(JSON.stringify(['set_size', dims.rows, dims.cols]));
          }
        }
      }, 200);
    });
    this._ro.observe(this.dom);
  }

  reconnect() {
    try { this.socket?.close(); } catch (_) {}
    this._connect();
  }

  dispose() {
    this.disposed = true;
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    try { this.socket?.close(); } catch (_) {}
    try { this._ro?.disconnect(); } catch (_) {}
    try { this.xterm?.dispose(); } catch (_) {}
    this.dom = null;
    this.xterm = null;
    this.fitAddon = null;
    this.socket = null;
  }
}
