import { Peer } from 'peerjs';
import QRCode from 'qrcode';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export function formatRoomCode(raw) {
  const clean = String(raw || '').replace(/\D/g, '').slice(0, 6);
  if (clean.length > 3) {
    return clean.slice(0, 3) + '-' + clean.slice(3);
  }
  return clean;
}

export function cleanRoomCode(formatted) {
  return String(formatted || '').replace(/\D/g, '').slice(0, 6);
}

export function generateRoomCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return formatRoomCode(String(num));
}

export function createLiveManager({
  editor,
  getCurrentDoc,
  onRemoteCode,
  onRemoteTerminal,
  onRemoteTerminalState,
  onSaveCopy,
  onSessionEnd,
  toast
}) {
  const $ = id => document.getElementById(id);
  const PEER_PREFIX = 'pseudostudio-live-v1-';
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  let peer = null;
  let activeConn = null; // For spectator
  const viewers = new Map(); // peerId -> { conn, username, joinedAt }

  let state = {
    role: null, // 'host' | 'spectator' | null
    roomCode: '',
    username: localStorage.getItem('pseudostudio_username') || '',
    hostName: '',
    autoFollow: true
  };

  let teacherDecorations = [];
  let isReceivingRemoteEdit = false;

  function setUsername(name) {
    const clean = String(name || '').trim().slice(0, 40);
    state.username = clean;
    localStorage.setItem('pseudostudio_username', clean);
    if ($('live-host-username')) $('live-host-username').value = clean;
    if ($('live-spectator-username')) $('live-spectator-username').value = clean;
  }

  function renderViewersList() {
    const listEl = $('live-viewers-list');
    const countEl = $('live-viewers-count');
    const badgeCountEl = $('live-badge-count');

    const count = viewers.size;
    if (countEl) countEl.textContent = `${count} espectador${count === 1 ? '' : 'es'}`;
    if (badgeCountEl) badgeCountEl.textContent = count;

    if (!listEl) return;
    if (count === 0) {
      listEl.innerHTML = '<div class="live-empty-viewers">Aún no se han conectado estudiantes. Comparte el código o el código QR.</div>';
      return;
    }

    const rows = [];
    viewers.forEach((v, id) => {
      const minutes = Math.floor((Date.now() - v.joinedAt) / 60000);
      const timeStr = minutes < 1 ? 'recién conectado' : `hace ${minutes} min`;
      const initials = (v.username || 'E').slice(0, 2).toUpperCase();

      rows.push(`
        <div class="live-viewer-item">
          <div class="live-viewer-avatar">${initials}</div>
          <div class="live-viewer-info">
            <span class="live-viewer-name">${v.username || 'Estudiante'}</span>
            <span class="live-viewer-time">${timeStr}</span>
          </div>
          <button class="live-viewer-kick icon-button" data-kick-peer="${id}" title="Expulsar de la sesión" aria-label="Expulsar a ${v.username}">
            <i data-lucide="user-x"></i>
          </button>
        </div>
      `);
    });

    listEl.innerHTML = rows.join('');
    listEl.querySelectorAll('[data-kick-peer]').forEach(btn => {
      btn.onclick = () => {
        const peerId = btn.dataset.kickPeer;
        kickViewer(peerId);
      };
    });
  }

  function updateActiveBar() {
    const bar = $('live-active-bar');
    const btn = $('live-share-btn');
    if (!bar) return;

    if (!state.role) {
      bar.classList.add('hidden');
      if (btn) {
        btn.classList.remove('is-hosting', 'is-spectating');
        btn.innerHTML = '<i data-lucide="radio"></i><span>En Vivo</span>';
      }
      return;
    }

    bar.classList.remove('hidden');

    if (state.role === 'host') {
      if (btn) {
        btn.classList.add('is-hosting');
        btn.classList.remove('is-spectating');
        btn.innerHTML = `<i data-lucide="radio"></i><span>En Vivo (${viewers.size})</span>`;
      }

      bar.innerHTML = `
        <div class="live-active-left">
          <span class="live-pulse-dot"></span>
          <b>TRANSMITIENDO EN VIVO</b>
          <span class="live-active-code">Código: <strong>${state.roomCode}</strong></span>
          <span class="live-active-viewers"><i data-lucide="users"></i> <span id="live-active-viewers-text">${viewers.size} espectador${viewers.size === 1 ? '' : 'es'}</span></span>
        </div>
        <div class="live-active-actions">
          <button id="live-bar-copy" class="secondary small"><i data-lucide="copy"></i>Copiar código</button>
          <button id="live-bar-qr" class="secondary small"><i data-lucide="qr-code"></i>Ver QR</button>
          <button id="live-bar-viewers" class="secondary small"><i data-lucide="users"></i>Estudiantes</button>
          <button id="live-bar-stop" class="danger small"><i data-lucide="square"></i>Finalizar</button>
        </div>
      `;

      $('live-bar-copy').onclick = () => {
        navigator.clipboard.writeText(state.roomCode);
        toast('Código de sesión copiado al portapapeles.');
      };
      $('live-bar-qr').onclick = () => showLiveDialog('host');
      $('live-bar-viewers').onclick = () => showLiveDialog('host');
      $('live-bar-stop').onclick = () => stopHost();
    } else if (state.role === 'spectator') {
      if (btn) {
        btn.classList.add('is-spectating');
        btn.classList.remove('is-hosting');
        btn.innerHTML = '<i data-lucide="eye"></i><span>Espectador</span>';
      }

      bar.innerHTML = `
        <div class="live-active-left">
          <span class="live-spectator-badge"><i data-lucide="eye"></i> MODO ESPECTADOR</span>
          <span>Viendo a: <strong>${state.hostName || 'Profesor'}</strong></span>
          <span class="live-active-code">Sesión: ${state.roomCode}</span>
        </div>
        <div class="live-active-actions">
          <button id="live-bar-save" class="secondary small" title="Guardar una copia de este algoritmo en tu computadora (Documentos)"><i data-lucide="download"></i>Guardar en PC</button>
          <button id="live-bar-follow" class="secondary small ${state.autoFollow ? 'active' : ''}">
            <i data-lucide="navigation"></i> Seguir cursor: ${state.autoFollow ? 'SÍ' : 'NO'}
          </button>
          <button id="live-bar-disconnect" class="danger small"><i data-lucide="log-out"></i>Desconectar</button>
        </div>
      `;

      $('live-bar-save').onclick = () => {
        if (typeof onSaveCopy === 'function') onSaveCopy();
      };
      $('live-bar-follow').onclick = () => {
        state.autoFollow = !state.autoFollow;
        updateActiveBar();
        toast(state.autoFollow ? 'Seguimiento de cursor activado.' : 'Seguimiento de cursor desactivado.');
      };
      $('live-bar-disconnect').onclick = () => disconnectSpectator();
    }
  }

  function clearTeacherDecorations() {
    if (editor && teacherDecorations.length) {
      teacherDecorations = editor.deltaDecorations(teacherDecorations, []);
    }
  }

  function updateTeacherCursor(cursor, selection, teacherName) {
    if (!editor || !cursor) return;
    const newDecs = [];

    if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
      newDecs.push({
        range: new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn),
        options: {
          className: 'teacher-selection',
          isWholeLine: false
        }
      });
    }

    newDecs.push({
      range: new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
      options: {
        className: 'teacher-cursor',
        before: {
          content: `👨‍🏫 ${teacherName} `,
          inlineClassName: 'teacher-cursor-badge'
        }
      }
    });

    teacherDecorations = editor.deltaDecorations(teacherDecorations, newDecs);

    if (state.autoFollow) {
      editor.revealPositionInCenterIfOutsideViewport(cursor);
    }
  }

  async function generateQR(text) {
    try {
      return await QRCode.toDataURL(text, {
        width: 220,
        margin: 1,
        color: {
          dark: '#14151c',
          light: '#ffffff'
        }
      });
    } catch (e) {
      console.error('Error generando QR:', e);
      return '';
    }
  }

  // === HOST (PROFESOR) ===
  async function startHost(customCode = null) {
    const username = state.username || 'Profesor';
    const rawCode = customCode ? cleanRoomCode(customCode) : cleanRoomCode(generateRoomCode());
    const formatted = formatRoomCode(rawCode);
    const peerId = PEER_PREFIX + rawCode;

    if (peer) {
      try { peer.destroy(); } catch {}
    }

    state.role = 'host';
    state.roomCode = formatted;
    state.hostName = username;
    viewers.clear();

    const peerObj = new Peer(peerId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer = peerObj;

    peer.on('open', async () => {
      toast(`Sesión iniciada. Código: ${formatted}`);
      const qrDataUrl = await generateQR(`pseudostudio://live/${rawCode}`);
      if ($('live-qr-img')) {
        $('live-qr-img').src = qrDataUrl;
        $('live-qr-img').alt = `Código QR para sesión ${formatted}`;
      }
      if ($('live-room-code-display')) $('live-room-code-display').textContent = formatted;
      $('live-host-setup').classList.add('hidden');
      $('live-host-active').classList.remove('hidden');
      renderViewersList();
      updateActiveBar();
    });

    peer.on('connection', conn => {
      conn.on('open', () => {
        // Connection opened, wait for join handshake
      });

      conn.on('data', data => {
        if (!data || typeof data !== 'object') return;

        if (data.type === 'join') {
          const studentName = String(data.username || 'Estudiante').trim().slice(0, 40);
          viewers.set(conn.peer, {
            conn,
            username: studentName,
            joinedAt: Date.now()
          });

          toast(`👤 ${studentName} se conectó como espectador.`);
          renderViewersList();
          updateActiveBar();

          // Send current full state to the newly joined spectator
          const doc = getCurrentDoc();
          conn.send({
            type: 'sync-full',
            hostName: username,
            roomCode: formatted,
            fileName: doc?.name || 'algoritmo.psc',
            code: doc?.content || '',
            cursor: editor.getPosition(),
            selection: editor.getSelection(),
            terminalOutput: $('console-output')?.textContent || ''
          });
        } else if (data.type === 'leave') {
          const viewer = viewers.get(conn.peer);
          if (viewer) {
            toast(`👤 ${viewer.username} se desconectó.`);
            viewers.delete(conn.peer);
            renderViewersList();
            updateActiveBar();
          }
        }
      });

      conn.on('close', () => {
        const viewer = viewers.get(conn.peer);
        if (viewer) {
          viewers.delete(conn.peer);
          renderViewersList();
          updateActiveBar();
        }
      });

      conn.on('error', err => {
        console.warn('Error en conexión con espectador:', err);
      });
    });

    peer.on('error', err => {
      console.error('PeerJS error:', err);
      if (err.type === 'unavailable-id') {
        toast('El código ya está en uso. Generando otro…', true);
        startHost();
      } else {
        toast(`Error de conexión en vivo: ${err.message}`, true);
      }
    });
  }

  function stopHost() {
    if (state.role === 'host') {
      broadcast({ type: 'host-ended', message: 'El profesor ha finalizado la sesión en vivo.' });
      viewers.forEach(v => {
        try { v.conn.close(); } catch {}
      });
      viewers.clear();
    }
    if (peer) {
      try { peer.destroy(); } catch {}
      peer = null;
    }
    state.role = null;
    state.roomCode = '';
    $('live-host-setup').classList.remove('hidden');
    $('live-host-active').classList.add('hidden');
    renderViewersList();
    updateActiveBar();
    toast('Transmisión en vivo finalizada.');
  }

  function kickViewer(peerId) {
    const viewer = viewers.get(peerId);
    if (!viewer) return;
    try {
      viewer.conn.send({ type: 'kicked', message: 'Has sido desconectado de la sesión.' });
      viewer.conn.close();
    } catch {}
    viewers.delete(peerId);
    renderViewersList();
    updateActiveBar();
    toast(`Estudiante «${viewer.username}» expulsado.`);
  }

  function broadcast(payload) {
    if (state.role !== 'host') return;
    const deadPeers = [];
    viewers.forEach((v, id) => {
      if (v.conn && v.conn.open) {
        try {
          v.conn.send(payload);
        } catch {
          deadPeers.push(id);
        }
      } else {
        deadPeers.push(id);
      }
    });
    if (deadPeers.length > 0) {
      for (const deadId of deadPeers) viewers.delete(deadId);
      renderViewersList();
      updateActiveBar();
    }
  }

  function broadcastTerminalClear() {
    broadcast({ type: 'terminal-clear' });
  }

  function broadcastSave(fileName) {
    broadcast({ type: 'host-saved', fileName });
  }

  // === SPECTATOR (ESTUDIANTE) ===
  function joinAsSpectator(codeToJoin, myUsername) {
    const raw = cleanRoomCode(codeToJoin);
    if (raw.length !== 6) {
      toast('Ingresa un código de sesión válido de 6 dígitos.', true);
      return;
    }

    const formatted = formatRoomCode(raw);
    const username = (myUsername || state.username || 'Estudiante').trim();
    setUsername(username);

    if (peer) {
      try { peer.destroy(); } catch {}
    }

    state.role = 'spectator';
    state.roomCode = formatted;
    state.hostName = 'Conectando…';
    updateActiveBar();

    const peerObj = new Peer({
      config: { iceServers: ICE_SERVERS },
      debug: 1
    });

    peer = peerObj;

    peer.on('open', () => {
      const targetPeerId = PEER_PREFIX + raw;
      const conn = peer.connect(targetPeerId, {
        metadata: { username }
      });

      activeConn = conn;

      conn.on('open', () => {
        conn.send({ type: 'join', username });
        toast(`Conectado a la sesión ${formatted} en modo espectador.`);
        $('live-dialog').close();
      });

      conn.on('data', data => {
        if (!data || typeof data !== 'object') return;

        if (data.type === 'sync-full') {
          state.hostName = data.hostName || 'Profesor';
          updateActiveBar();

          if (onRemoteCode) {
            isReceivingRemoteEdit = true;
            onRemoteCode(data.fileName, data.code, true /* isReadOnly */);
            isReceivingRemoteEdit = false;
          }

          if (data.cursor) {
            updateTeacherCursor(data.cursor, data.selection, state.hostName);
          }

          if (data.terminalOutput && onRemoteTerminal) {
            onRemoteTerminal(data.terminalOutput, true /* replace */);
          }
        } else if (data.type === 'code-update') {
          if (onRemoteCode) {
            isReceivingRemoteEdit = true;
            onRemoteCode(data.fileName, data.code, true);
            isReceivingRemoteEdit = false;
          }
          if (data.cursor) {
            updateTeacherCursor(data.cursor, data.selection, state.hostName);
          }
        } else if (data.type === 'cursor-update') {
          updateTeacherCursor(data.cursor, data.selection, state.hostName);
        } else if (data.type === 'terminal-chunk') {
          if (onRemoteTerminal) {
            onRemoteTerminal(data.chunk, false);
          }
        } else if (data.type === 'terminal-clear') {
          if (onRemoteTerminal) {
            onRemoteTerminal('', true /* replace */);
          }
        } else if (data.type === 'host-saved') {
          toast(`💾 El profesor guardó «${data.fileName || 'el algoritmo'}».`);
        } else if (data.type === 'run-state') {
          if (onRemoteTerminalState) {
            onRemoteTerminalState(data);
          }
        } else if (data.type === 'host-ended' || data.type === 'kicked') {
          toast(data.message || 'La sesión ha finalizado.', true);
          disconnectSpectator(true);
        }
      });

      conn.on('close', () => {
        toast('Conexión con el profesor finalizada.');
        disconnectSpectator(true);
      });

      conn.on('error', err => {
        toast(`Error de conexión: ${err.message}`, true);
        disconnectSpectator(false);
      });
    });

    peer.on('error', err => {
      console.error('Peer error en espectador:', err);
      toast('No se pudo encontrar la sesión con ese código. Verifica que el profesor haya iniciado la transmisión.', true);
      disconnectSpectator(false);
    });
  }

  function disconnectSpectator(isHostEnded = false) {
    if (activeConn) {
      try {
        activeConn.send({ type: 'leave', username: state.username });
        activeConn.close();
      } catch {}
      activeConn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch {}
      peer = null;
    }
    clearTeacherDecorations();
    state.role = null;
    state.roomCode = '';
    state.hostName = '';
    updateActiveBar();

    // Restore editor to editable mode
    if (editor) {
      editor.updateOptions({ readOnly: false });
    }

    if (typeof onSessionEnd === 'function') {
      onSessionEnd({ isHostEnded });
    }
  }

  // === LISTENERS DEL EDITOR PARA DIFUNDIR CAMBIOS (HOST) ===
  let cursorThrottleTimer = null;
  let pendingCursor = null;

  function onCursorChange(position) {
    if (state.role === 'host') {
      pendingCursor = {
        cursor: position,
        selection: editor ? editor.getSelection() : null
      };
      if (!cursorThrottleTimer) {
        cursorThrottleTimer = setTimeout(() => {
          cursorThrottleTimer = null;
          if (pendingCursor && state.role === 'host') {
            broadcast({
              type: 'cursor-update',
              cursor: pendingCursor.cursor,
              selection: pendingCursor.selection
            });
            pendingCursor = null;
          }
        }, 50); // 20 fps max: ultra-fluid, zero lag for 50+ spectators
      }
    }
  }

  editor.onDidChangeModelContent(() => {
    if (state.role === 'host' && !isReceivingRemoteEdit) {
      const doc = getCurrentDoc();
      if (!doc) return;
      broadcast({
        type: 'code-update',
        fileName: doc.name,
        code: doc.content,
        cursor: editor.getPosition(),
        selection: editor.getSelection()
      });
    }
  });

  editor.onDidChangeCursorPosition(e => {
    onCursorChange(e.position);
  });

  function showLiveDialog(initialTab = 'host') {
    const dialog = $('live-dialog');
    if (!dialog) return;

    if (state.username) {
      if ($('live-host-username')) $('live-host-username').value = state.username;
      if ($('live-spectator-username')) $('live-spectator-username').value = state.username;
    }

    for (const t of ['host', 'spectator']) {
      const pane = $('live-tab-' + t);
      if (pane) pane.classList.toggle('hidden', t !== initialTab);
      const btn = $(`[data-live-tab="${t}"]`);
      if (btn) btn.classList.toggle('active', t === initialTab);
    }

    dialog.showModal();
  }

  // Setup DOM buttons and events
  if ($('live-share-btn')) {
    $('live-share-btn').onclick = () => {
      if (state.role === 'host') showLiveDialog('host');
      else if (state.role === 'spectator') showLiveDialog('spectator');
      else showLiveDialog('host');
    };
  }

  document.querySelectorAll('[data-live-tab]').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.liveTab;
      for (const t of ['host', 'spectator']) {
        const pane = $('live-tab-' + t);
        if (pane) pane.classList.toggle('hidden', t !== tab);
        const b = $(`[data-live-tab="${t}"]`);
        if (b) b.classList.toggle('active', t === tab);
      }
    };
  });

  if ($('live-start-host-btn')) {
    $('live-start-host-btn').onclick = () => {
      const inputName = $('live-host-username')?.value.trim();
      if (inputName) setUsername(inputName);
      startHost();
    };
  }

  if ($('live-copy-code-btn')) {
    $('live-copy-code-btn').onclick = () => {
      if (state.roomCode) {
        navigator.clipboard.writeText(state.roomCode);
        toast('Código de sesión copiado al portapapeles.');
      }
    };
  }

  if ($('live-stop-host-btn')) {
    $('live-stop-host-btn').onclick = () => stopHost();
  }

  if ($('live-join-spectator-btn')) {
    $('live-join-spectator-btn').onclick = () => {
      const inputName = $('live-spectator-username')?.value.trim();
      const codeVal = $('live-join-code')?.value.trim();
      if (!inputName) {
        toast('Por favor escribe tu nombre de usuario.', true);
        return;
      }
      if (!codeVal) {
        toast('Por favor escribe el código de 6 dígitos que te dio el profesor.', true);
        return;
      }
      setUsername(inputName);
      joinAsSpectator(codeVal, inputName);
    };
  }

  if ($('live-join-code')) {
    $('live-join-code').addEventListener('input', e => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = formatRoomCode(raw);
    });
  }

  return {
    startHost,
    stopHost,
    joinAsSpectator,
    disconnectSpectator,
    showLiveDialog,
    setUsername,
    broadcastTerminalChunk(chunk) {
      if (state.role === 'host') {
        broadcast({ type: 'terminal-chunk', chunk });
      }
    },
    broadcastTerminalClear,
    broadcastSave,
    onCursorChange,
    onDocumentChange(doc) {
      if (state.role === 'host' && doc && !isReceivingRemoteEdit) {
        const content = doc.model ? doc.model.getValue() : (doc.content || '');
        broadcast({
          type: 'code-update',
          fileName: doc.name,
          code: content,
          cursor: editor ? editor.getPosition() : null,
          selection: editor ? editor.getSelection() : null
        });
      }
    },
    onDocContentChange(doc) {
      if (state.role === 'host' && doc && !isReceivingRemoteEdit) {
        const content = doc.model ? doc.model.getValue() : (doc.content || '');
        broadcast({
          type: 'code-update',
          fileName: doc.name,
          code: content,
          cursor: editor ? editor.getPosition() : null,
          selection: editor ? editor.getSelection() : null
        });
      }
    },
    broadcastRunState(runState) {
      if (state.role === 'host') {
        broadcast({ type: 'run-state', ...runState });
      }
    },
    isSpectating: () => state.role === 'spectator',
    isHosting: () => state.role === 'host',
    getState() {
      return { ...state, viewersCount: viewers.size };
    }
  };
}
