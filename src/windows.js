// Floating Window Manager (MDI - Multiple Document Interface / Ventanas Independientes)
export function createWindowManager({ onDockChange, onDiagramLine }) {
  const $ = id => document.getElementById(id);
  
  const defaultState = {
    terminal: { floating: false, x: 140, y: 200, width: 720, height: 420, minimized: false, maximized: false },
    diagram: { floating: false, x: 220, y: 90, width: 860, height: 560, minimized: false, maximized: false }
  };

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('floatingWindowsState')) || {};
  } catch {}

  const state = {
    terminal: { ...defaultState.terminal, ...saved.terminal },
    diagram: { ...defaultState.diagram, ...saved.diagram }
  };

  let zCounter = 1000;
  function persist() {
    try {
      localStorage.setItem('floatingWindowsState', JSON.stringify(state));
    } catch {}
    if (typeof onDockChange === 'function') onDockChange(state);
  }

  function bringToFront(winEl) {
    if (!winEl) return;
    zCounter += 2;
    winEl.style.zIndex = zCounter;
  }

  function applyWindowPos(id) {
    const win = $(`float-win-${id}`);
    if (!win) return;
    const s = state[id];

    if (s.maximized) {
      win.classList.add('is-maximized');
      win.style.left = '10px';
      win.style.top = '52px';
      win.style.width = 'calc(100vw - 20px)';
      win.style.height = 'calc(100vh - 80px)';
    } else {
      win.classList.remove('is-maximized');
      // Constrain inside viewport
      const maxW = Math.max(360, window.innerWidth - 40);
      const maxH = Math.max(220, window.innerHeight - 80);
      const w = Math.min(Math.max(340, s.width), maxW);
      const h = Math.min(Math.max(200, s.height), maxH);
      const x = Math.min(Math.max(10, s.x), window.innerWidth - w - 10);
      const y = Math.min(Math.max(45, s.y), window.innerHeight - h - 10);

      win.style.left = x + 'px';
      win.style.top = y + 'px';
      win.style.width = w + 'px';
      win.style.height = h + 'px';
    }

    win.classList.toggle('is-minimized', !!s.minimized);
    const minPill = $(`min-pill-${id}`);
    if (minPill) minPill.classList.toggle('hidden', !s.minimized || !s.floating);
  }

  function setupDraggable(id) {
    const win = $(`float-win-${id}`);
    const header = $(`float-win-${id}-header`);
    if (!win || !header) return;

    win.addEventListener('pointerdown', () => bringToFront(win));

    let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      if (state[id].maximized) return;

      bringToFront(win);
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      header.setPointerCapture(e.pointerId);
      win.classList.add('is-dragging');
    });

    header.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = Math.max(0, Math.min(window.innerWidth - 120, initialLeft + dx));
      const newY = Math.max(35, Math.min(window.innerHeight - 60, initialTop + dy));

      win.style.left = newX + 'px';
      win.style.top = newY + 'px';
      state[id].x = newX;
      state[id].y = newY;
    });

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      win.classList.remove('is-dragging');
      persist();
    };

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);

    // Double-click header to maximize/restore
    header.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      toggleMaximize(id);
    });
  }

  function setupResizable(id) {
    const win = $(`float-win-${id}`);
    if (!win) return;

    const handles = win.querySelectorAll('.win-resize-handle');
    handles.forEach(handle => {
      let isResizing = false, startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
      const dir = handle.dataset.direction;

      handle.addEventListener('pointerdown', (e) => {
        if (state[id].maximized) return;
        e.preventDefault();
        e.stopPropagation();
        bringToFront(win);

        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.getBoundingClientRect();
        startW = rect.width;
        startH = rect.height;
        startL = rect.left;
        startT = rect.top;

        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('window-resizing');
      });

      handle.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = startW, newH = startH, newL = startL, newT = startT;

        if (dir.includes('e')) newW = Math.max(340, startW + dx);
        if (dir.includes('s')) newH = Math.max(200, startH + dy);
        if (dir.includes('w')) {
          newW = Math.max(340, startW - dx);
          newL = startL + (startW - newW);
        }
        if (dir.includes('n')) {
          newH = Math.max(200, startH - dy);
          newT = startT + (startH - newH);
        }

        win.style.width = newW + 'px';
        win.style.height = newH + 'px';
        win.style.left = newL + 'px';
        win.style.top = newT + 'px';

        state[id].width = newW;
        state[id].height = newH;
        state[id].x = newL;
        state[id].y = newT;
      });

      const stopResize = () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('window-resizing');
        persist();
      };

      handle.addEventListener('pointerup', stopResize);
      handle.addEventListener('pointercancel', stopResize);
    });
  }

  function popoutTerminal() {
    const win = $('float-win-terminal');
    const bottomPanel = $('bottom-panel');
    const winBody = $('float-terminal-body');
    if (!win || !bottomPanel || !winBody) return;

    state.terminal.floating = true;
    state.terminal.minimized = false;

    // Move panel contents into floating window
    if (bottomPanel.parentElement !== winBody) {
      winBody.appendChild(bottomPanel);
    }

    bottomPanel.classList.remove('hidden');
    win.classList.remove('hidden');
    $('panel-resizer')?.classList.add('hidden');
    bringToFront(win);
    applyWindowPos('terminal');
    persist();
  }

  function dockTerminal() {
    const win = $('float-win-terminal');
    const bottomPanel = $('bottom-panel');
    const editorColumn = $('editor-column');
    if (!win || !bottomPanel || !editorColumn) return;

    state.terminal.floating = false;
    state.terminal.minimized = false;

    // Move bottom panel back into editor column
    if (bottomPanel.parentElement !== editorColumn) {
      editorColumn.appendChild(bottomPanel);
    }

    win.classList.add('hidden');
    $('panel-resizer')?.classList.remove('hidden');
    bottomPanel.classList.remove('hidden');
    persist();
  }

  function popoutDiagram() {
    const win = $('float-win-diagram');
    const diagramView = $('diagram-view');
    const winBody = $('float-diagram-body');
    const editor = $('editor');
    if (!win || !diagramView || !winBody) return;

    state.diagram.floating = true;
    state.diagram.minimized = false;

    // Move diagram view into floating window
    if (diagramView.parentElement !== winBody) {
      winBody.appendChild(diagramView);
    }

    // Keep editor visible when diagram is popped out!
    if (editor) editor.classList.remove('hidden');
    diagramView.classList.remove('hidden');
    win.classList.remove('hidden');

    bringToFront(win);
    applyWindowPos('diagram');
    persist();
  }

  function dockDiagram() {
    const win = $('float-win-diagram');
    const diagramView = $('diagram-view');
    const editorMain = $('editor-main');
    if (!win || !diagramView || !editorMain) return;

    state.diagram.floating = false;
    state.diagram.minimized = false;

    // Move diagram view back to editor main
    if (diagramView.parentElement !== editorMain) {
      editorMain.appendChild(diagramView);
    }

    win.classList.add('hidden');
    persist();
  }

  function toggleMaximize(id) {
    state[id].maximized = !state[id].maximized;
    applyWindowPos(id);
    persist();
  }

  function toggleMinimize(id) {
    state[id].minimized = !state[id].minimized;
    applyWindowPos(id);
    persist();
  }

  function showFloating(id) {
    if (!state[id].floating) {
      if (id === 'terminal') popoutTerminal();
      else if (id === 'diagram') popoutDiagram();
    } else {
      state[id].minimized = false;
      const win = $(`float-win-${id}`);
      if (win) {
        win.classList.remove('hidden');
        bringToFront(win);
        applyWindowPos(id);
      }
    }
    persist();
  }

  function setupTearOff() {
    // Tear-off terminal: dragging panel header with mouse or clicking popout button
    const popoutTermBtn = $('panel-popout');
    if (popoutTermBtn) {
      popoutTermBtn.onclick = () => {
        if (state.terminal.floating) dockTerminal();
        else popoutTerminal();
      };
    }

    const popoutDiagBtn = $('flow-popout');
    if (popoutDiagBtn) {
      popoutDiagBtn.onclick = () => {
        if (state.diagram.floating) dockDiagram();
        else popoutDiagram();
      };
    }

    // Drag header to tear off terminal
    const panelHeader = document.querySelector('#bottom-panel .panel-header');
    if (panelHeader) {
      let isDraggingPanel = false;
      let startX = 0, startY = 0;
      panelHeader.addEventListener('pointerdown', (e) => {
        if (state.terminal.floating) return;
        if (e.target.closest('button, input, select, .panel-tabs')) return;
        isDraggingPanel = true;
        startX = e.clientX;
        startY = e.clientY;
      });
      window.addEventListener('pointermove', (e) => {
        if (!isDraggingPanel) return;
        if (Math.abs(e.clientY - startY) > 20 || Math.abs(e.clientX - startX) > 20) {
          isDraggingPanel = false;
          popoutTerminal();
          state.terminal.x = Math.max(20, Math.min(window.innerWidth - 300, e.clientX - 150));
          state.terminal.y = Math.max(50, Math.min(window.innerHeight - 200, e.clientY - 20));
          applyWindowPos('terminal');
        }
      });
      window.addEventListener('pointerup', () => { isDraggingPanel = false; });
      window.addEventListener('pointercancel', () => { isDraggingPanel = false; });
    }

    // Drag toolbar to tear off diagram
    const diagramToolbar = document.querySelector('.diagram-toolbar');
    if (diagramToolbar) {
      let isDraggingDiag = false;
      let dStartX = 0, dStartY = 0;
      diagramToolbar.addEventListener('pointerdown', (e) => {
        if (state.diagram.floating) return;
        if (e.target.closest('button, input, select')) return;
        isDraggingDiag = true;
        dStartX = e.clientX;
        dStartY = e.clientY;
      });
      window.addEventListener('pointermove', (e) => {
        if (!isDraggingDiag) return;
        if (Math.abs(e.clientY - dStartY) > 20 || Math.abs(e.clientX - dStartX) > 20) {
          isDraggingDiag = false;
          popoutDiagram();
          state.diagram.x = Math.max(20, Math.min(window.innerWidth - 300, e.clientX - 150));
          state.diagram.y = Math.max(50, Math.min(window.innerHeight - 200, e.clientY - 20));
          applyWindowPos('diagram');
        }
      });
      window.addEventListener('pointerup', () => { isDraggingDiag = false; });
      window.addEventListener('pointercancel', () => { isDraggingDiag = false; });
    }

    // Window controls
    $('float-terminal-dock')?.addEventListener('click', dockTerminal);
    $('float-terminal-min')?.addEventListener('click', () => toggleMinimize('terminal'));
    $('float-terminal-max')?.addEventListener('click', () => toggleMaximize('terminal'));
    $('float-terminal-close')?.addEventListener('click', () => {
      $('float-win-terminal')?.classList.add('hidden');
      state.terminal.minimized = true;
      applyWindowPos('terminal');
      persist();
    });

    $('float-diagram-dock')?.addEventListener('click', dockDiagram);
    $('float-diagram-min')?.addEventListener('click', () => toggleMinimize('diagram'));
    $('float-diagram-max')?.addEventListener('click', () => toggleMaximize('diagram'));
    $('float-diagram-close')?.addEventListener('click', () => {
      $('float-win-diagram')?.classList.add('hidden');
      if (typeof options.onDiagramClose === 'function') {
        options.onDiagramClose();
      } else {
        $('diagram-view')?.classList.add('hidden');
        $('editor')?.classList.remove('hidden');
      }
      state.diagram.minimized = true;
      applyWindowPos('diagram');
      persist();
    });

    // Minimized pills in taskbar
    $('min-pill-terminal')?.addEventListener('click', () => {
      state.terminal.minimized = false;
      showFloating('terminal');
    });
    $('min-pill-diagram')?.addEventListener('click', () => {
      state.diagram.minimized = false;
      showFloating('diagram');
    });
  }

  function init() {
    setupDraggable('terminal');
    setupResizable('terminal');
    setupDraggable('diagram');
    setupResizable('diagram');
    setupTearOff();

    // If previously saved as floating, apply it
    if (state.terminal.floating) popoutTerminal();
    if (state.diagram.floating) popoutDiagram();
  }

  return {
    init,
    popoutTerminal,
    dockTerminal,
    popoutDiagram,
    dockDiagram,
    showFloating,
    toggleMaximize,
    toggleMinimize,
    isTerminalFloating: () => state.terminal.floating,
    isDiagramFloating: () => state.diagram.floating,
    getState: () => ({ ...state })
  };
}
