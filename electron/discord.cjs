const net = require('node:net');
const path = require('node:path');

const CLIENT_ID = '383226320970055681'; // Registered Rich Presence client ID
const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;

class DiscordRPC {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.enabled = false;
    this.sessionStart = Math.floor(Date.now() / 1000);
    this.currentActivity = null;
    this.reconnectTimer = null;
    this.updateDebounceTimer = null;
  }

  setEnabled(enable) {
    this.enabled = Boolean(enable);
    if (this.enabled) {
      if (!this.connected) this.connect();
      else if (this.currentActivity) this.sendActivity(this.currentActivity);
    } else {
      this.clearActivity();
      this.disconnect();
    }
  }

  connect() {
    if (this.socket || !this.enabled) return;

    // Discord on Windows listens on \\?\pipe\discord-ipc-0 through 9
    const tryPipe = (index) => {
      if (index > 9 || !this.enabled) return;

      const pipePath = `\\\\?\\pipe\\discord-ipc-${index}`;
      const sock = net.createConnection(pipePath);

      sock.on('connect', () => {
        this.socket = sock;
        this.connected = false;
        this.send(OP_HANDSHAKE, { v: 1, client_id: CLIENT_ID });
      });

      sock.on('data', (data) => {
        try {
          if (data.length < 8) return;
          const op = data.readInt32LE(0);
          const len = data.readInt32LE(4);
          const raw = data.slice(8, 8 + len).toString('utf8');
          const res = JSON.parse(raw);

          if (res.evt === 'READY' || op === OP_FRAME) {
            this.connected = true;
            if (this.currentActivity) {
              this.sendActivity(this.currentActivity);
            }
          }
        } catch {
          // Ignore malformed packet
        }
      });

      sock.on('error', () => {
        sock.destroy();
        if (this.socket === sock) this.socket = null;
        if (index < 9) {
          tryPipe(index + 1);
        } else {
          // Schedule reconnect attempt in 15 seconds if Discord wasn't open yet
          clearTimeout(this.reconnectTimer);
          if (this.enabled) {
            this.reconnectTimer = setTimeout(() => this.connect(), 15000);
          }
        }
      });

      sock.on('close', () => {
        if (this.socket === sock) {
          this.socket = null;
          this.connected = false;
          if (this.enabled) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 10000);
          }
        }
      });
    };

    tryPipe(0);
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.updateDebounceTimer);
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
  }

  send(op, payload) {
    if (!this.socket || this.socket.destroyed) return;
    try {
      const jsonStr = JSON.stringify(payload);
      const byteLen = Buffer.byteLength(jsonStr);
      const packet = Buffer.alloc(8 + byteLen);
      packet.writeInt32LE(op, 0);
      packet.writeInt32LE(byteLen, 4);
      packet.write(jsonStr, 8);
      this.socket.write(packet);
    } catch {
      // socket error
    }
  }

  sendActivity(act) {
    if (!this.connected) return;
    this.send(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: act
      },
      nonce: String(Date.now())
    });
  }

  update({ fileName, line = 1, col = 1, projectName = '', isRunning = false, isDebug = false, profile = 'Flexible' }) {
    if (!this.enabled) return;

    clearTimeout(this.updateDebounceTimer);
    this.updateDebounceTimer = setTimeout(() => {
      let details = 'En blanco';
      let state = 'PseudoStudio';

      if (fileName) {
        details = isRunning
          ? `${isDebug ? 'Depurando' : 'Ejecutando'}: ${fileName}`
          : `Editando: ${fileName}`;
      }

      if (projectName) {
        state = `Proyecto: ${projectName} · Lín ${line}`;
      } else if (fileName) {
        state = `Lín ${line}, Col ${col} · ${profile}`;
      } else {
        state = `PSeInt · ${profile}`;
      }

      const activity = {
        details,
        state,
        timestamps: { start: this.sessionStart },
        assets: {
          large_image: 'visualstudio_code',
          large_text: 'PseudoStudio IDE',
          small_image: isRunning ? 'running' : 'pseint',
          small_text: `PSeInt · ${profile}`
        }
      };

      this.currentActivity = activity;
      this.sendActivity(activity);
    }, 400);
  }

  clearActivity() {
    this.currentActivity = null;
    if (this.connected) {
      this.send(OP_FRAME, {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity: null
        },
        nonce: String(Date.now())
      });
    }
  }
}

module.exports = { DiscordRPC };
