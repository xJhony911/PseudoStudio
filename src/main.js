import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding';
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions';
import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching';
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter';
import { SnippetController2 } from 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { createIcons, icons } from 'lucide';
import { themes, registerThemes, allThemes } from './themes';
import { setupLanguage, symbols, getCurrentSymbol } from './language';
import { examples } from './examples';
import './style.css';
import { createLayout } from './layout';
import { createDiagrams } from './diagrams';
import { createCommandsManager, insertCommandSnippet } from './commands';
import { createLiveManager } from './live';
import { registerVSCodeShortcuts, moveLineUp, moveLineDown, copyLineUp, copyLineDown, deleteLine } from './shortcuts';
import { createWindowManager } from './windows';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
const $ = id => document.getElementById(id);
const api = window.studio;
const icon = name => `<i data-lucide="${name}"></i>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const defaults = {
  theme: 'obsidian',
  uiMode: 'modern',
  floatingTerminal: false,
  floatingDiagram: false,
  fontFamily: 'Comic Mono',
  fontSize: 16,
  lineHeight: 1.7,
  tabSize: 4,
  minimap: true,
  stickyScroll: true,
  cursorStyle: 'line',
  cursorBlinking: 'smooth',
  renderWhitespace: 'none',
  wordWrap: false,
  autoCheck: true,
  bracketColors: true,
  ligatures: false,
  accent: null,
  profile: 'Flexible'
};
let settings = { ...defaults, ...readStore('settings', {}) };
let extensions = [], catalog = [], fonts = [], documents = [], current = null, counter = 1, running = false, debugging = false, runDocument = null, runStarted = 0, checking = false, pendingCheck = false, aiBusy = false;
let activeExtTab = 'catalog', extSearchQuery = '';
let debugDecorations = [], watchNames = [], watchValues = {}, checkTimer, draftTimer, toastTimer;
let terminalPending = '', inputKind = 'line';
let project = null, selectedFolder = '', entryDirectory = false;
const expandedFolders = new Set();
let projectRenderVersion = 0, navigationVersion = 0;
const sectionState = readStore('explorerSections', { project: true, files: true, outline: true });
const pathKey = value => String(value || '').replace(/\\/g, '/').toLowerCase();

function applySections() {
  for (const [name, content] of [['project','project-tree'], ['outline','outline']]) {
    if ($(name + '-toggle') && $(content)) {
      $(name + '-toggle').setAttribute('aria-expanded', String(sectionState[name] !== false));
      $(content).classList.toggle('hidden', sectionState[name] === false);
    }
  }
}
for (const name of ['project', 'outline']) {
  if ($(name + '-toggle')) {
    $(name + '-toggle').onclick = () => {
      sectionState[name] = sectionState[name] === false;
      localStorage.setItem('explorerSections', JSON.stringify(sectionState)); applySections();
    };
  }
}
function persistProjectTree() {
  if (project) localStorage.setItem('projectTree', JSON.stringify({ path:project.path, expanded:[...expandedFolders], selected:selectedFolder }));
}
function restoreProjectTree() {
  expandedFolders.clear(); selectedFolder = '';
  const saved = readStore('projectTree', {});
  if (project && pathKey(saved.path) === pathKey(project.path)) {
    for (const relative of saved.expanded || []) expandedFolders.add(relative);
    selectedFolder = saved.selected || '';
  }
}
function highlightProjectFile() {
  for (const row of $('project-tree').querySelectorAll('[data-file-path]')) row.classList.toggle('active', pathKey(row.dataset.filePath) === pathKey(current?.path));
}
function toast(message, error = false) {
  $('toast').textContent = String(message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  $('toast').classList.toggle('error', error);
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), error ? 6500 : 3300);
}
const safe = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(err => toast(err.message, true));
function persistSettings() { try { localStorage.setItem('settings', JSON.stringify(settings)); } catch { toast('No se pudieron guardar los ajustes locales.', true); } }
function persistDrafts() {
  try {
    const filesToSave = documents.filter(d => !d.isLiveSession).map(d => ({
      id: d.id, name: d.name, path: d.path, content: d.model.getValue(),
      savedContent: d.savedContent, pristine: d.pristine
    }));
    const activeId = (current && !current.isLiveSession) ? current.id : filesToSave[0]?.id;
    localStorage.setItem('drafts', JSON.stringify({ active: activeId, files: filesToSave }));
  }
  catch { toast('No hay espacio para recuperar todos los borradores. Guarda tus archivos.', true); }
}

setupLanguage(monaco, () => extensions, () => settings.tabSize);
registerThemes(monaco);

const editor = monaco.editor.create($('editor'), {
  language: 'pseint',
  theme: 'obsidian',
  automaticLayout: true,
  fontFamily: '"Comic Mono", Consolas, monospace',
  fontSize: 16,
  lineHeight: 27,
  padding: { top: 19, bottom: 24 },
  minimap: { enabled: true, scale: 1, maxColumn: 90, renderCharacters: false },
  stickyScroll: { enabled: settings.stickyScroll !== false, maxLineCount: 5 },
  cursorStyle: settings.cursorStyle || 'line',
  cursorBlinking: settings.cursorBlinking || 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderWhitespace: settings.renderWhitespace || 'none',
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderLineHighlight: 'all',
  lineNumbersMinChars: 4,
  glyphMargin: true,
  overviewRulerBorder: false,
  tabSize: 4,
  insertSpaces: true,
  suggest: { showWords: false, preview: true },
  quickSuggestions: { other: true, comments: false, strings: false },
  bracketPairColorization: { enabled: true },
  guides: { indentation: true },
  fixedOverflowWidgets: true,
  contextmenu: true
});

registerVSCodeShortcuts(editor, monaco, {
  toggleWordWrap: () => {
    settings.wordWrap = !settings.wordWrap;
    applySettings();
    syncSettingsForm();
    toast('Ajuste de línea: ' + (settings.wordWrap ? 'Activado' : 'Desactivado'));
  }
});

const layout = createLayout();

const windowManager = createWindowManager({
  onDockChange: () => renderFiles(),
  onDiagramLine: showLine,
  onDiagramClose: () => diagrams.code()
});

const diagrams = createDiagrams({
  api,
  getDocument: () => current ? { id: current.id, name: current.name, content: current.model.getValue(), model: current.model } : null,
  getProfile: () => settings.profile,
  onProblems: errors => { if (current) setDiagnostics(current, errors); },
  onLine: showLine,
  toast,
  editor,
  onModeChange: () => renderFiles(),
  refreshIcons,
  isFloating: () => windowManager.isDiagramFloating() || settings.floatingDiagram || settings.uiMode === 'classic-pseint',
  onPopout: () => windowManager.popoutDiagram(),
  onDock: () => windowManager.dockDiagram()
});

windowManager.init();

const commandsManager = createCommandsManager({
  editor,
  getProfile: () => settings.profile,
  onInserted: (cmd, isAlt) => {
    toast(`Instrucción «${cmd.name}» insertada${isAlt ? ' (variante)' : ''}.`);
  },
  toast
});

let liveSessionDoc = null;

const liveManager = createLiveManager({
  editor,
  getCurrentDoc: () => current ? { id: current.id, name: current.name, content: current.model.getValue() } : null,
  onRemoteCode: (fileName, code, isReadOnly) => {
    if (liveSessionDoc && !liveSessionDoc.model.isDisposed()) {
      if (fileName && liveSessionDoc.name !== fileName) {
        liveSessionDoc.name = fileName;
        $('breadcrumb-file').textContent = fileName;
      }
      liveSessionDoc.model.setValue(code);
      if (current !== liveSessionDoc) activate(liveSessionDoc);
    } else {
      liveSessionDoc = newDocument({
        name: fileName || 'algoritmo_en_vivo.psc',
        content: code,
        pristine: true
      });
      liveSessionDoc.isLiveSession = true;
    }
    editor.updateOptions({ readOnly: isReadOnly });
    renderFiles();
  },
  onRemoteTerminal: (chunk, replace) => {
    showPanel('console');
    const clean = String(chunk || '')
      .replace(/\x1b\[z[a-zA-Z0-9]*/gi, '')
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
      .replace(/\x1b/g, '');
    if (replace) {
      $('console-output').textContent = clean;
    } else {
      appendOutput(clean, true /* isRemote */);
    }
  },
  onRemoteTerminalState: (st) => {
    if (st.running) {
      $('run-state').innerHTML = '<span class="tiny-dot"></span>' + (st.debug ? 'Profesor depurando' : 'Profesor ejecutando');
    } else {
      $('run-state').textContent = 'Listo para ejecutar';
    }
  },
  onSaveCopy: async () => {
    if (liveSessionDoc && current === liveSessionDoc) {
      const code = liveSessionDoc.model.getValue();
      const res = await api.save({ saveAs: true, name: liveSessionDoc.name, content: code });
      if (res) {
        liveSessionDoc.path = res.path;
        liveSessionDoc.name = res.name;
        liveSessionDoc.isLiveSession = false;
        persistDrafts();
        renderFiles();
        toast(`Algoritmo guardado en «${res.path}».`);
      }
    } else if (current) {
      saveFile(true);
    }
  },
  onSessionEnd: async ({ isHostEnded }) => {
    if (liveSessionDoc && !liveSessionDoc.model.isDisposed()) {
      const docToHandle = liveSessionDoc;
      liveSessionDoc = null;
      const shouldSave = await api.confirm(
        isHostEnded
          ? 'La sesión en vivo ha finalizado por el profesor. ¿Deseas guardar una copia del algoritmo en tu computadora (Documentos)?'
          : 'Te has desconectado de la sesión en vivo. ¿Deseas guardar una copia del algoritmo en tu computadora (Documentos)?'
      );
      if (shouldSave) {
        const code = docToHandle.model.getValue();
        const res = await api.save({ saveAs: true, name: docToHandle.name, content: code });
        if (res) {
          docToHandle.path = res.path;
          docToHandle.name = res.name;
          docToHandle.isLiveSession = false;
          persistDrafts();
          renderFiles();
          toast(`Copia guardada en «${res.path}».`);
          return;
        }
      }
      await closeDocument(docToHandle.id);
      toast('Sesión finalizada. Algoritmo temporal cerrado sin guardar.');
    }
  },
  toast
});

function isDirty(d) { return d.model.getValue() !== d.savedContent || (!d.path && !d.pristine); }

function newDocument({ name = `algoritmo${counter++}.psc`, content = 'Algoritmo MiAlgoritmo\n    \nFinAlgoritmo\n', path = null, id = crypto.randomUUID(), savedContent = content, pristine = false } = {}, activateNow = true) {
  if (debugging) { toast('Termina la depuración antes de cambiar de archivo.'); return; }
  const model = monaco.editor.createModel(content, 'pseint', monaco.Uri.parse(`inmemory://studio/${id}/${encodeURIComponent(name)}`));
  model.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  const doc = { id, name, path, model, savedContent, pristine, diagnostics: [] };
  model.onDidChangeContent(() => {
    if (current?.model === model) {
      diagrams.changed();
      liveManager.onDocContentChange(doc);
      notifyDiscord();
    }
    renderFiles();
    renderOutline();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDrafts, 400);
    scheduleCheck();
  });
  documents.push(doc);
  if (activateNow) activate(doc);
  else renderFiles();
  return doc;
}

function updateBreadcrumbSymbol() {
  if (!current) {
    if ($('breadcrumb-symbol-wrap')) $('breadcrumb-symbol-wrap').classList.add('hidden');
    return;
  }
  const pos = editor.getPosition();
  if (!pos) return;
  const sym = getCurrentSymbol(current.model.getValue(), pos.lineNumber);
  if (sym && $('breadcrumb-symbol-wrap') && $('breadcrumb-symbol')) {
    $('breadcrumb-symbol').textContent = sym.name;
    $('breadcrumb-symbol-wrap').classList.remove('hidden');
  } else if ($('breadcrumb-symbol-wrap')) {
    $('breadcrumb-symbol-wrap').classList.add('hidden');
  }
}

function activate(doc) {
  navigationVersion++;
  if (!doc || doc.model.isDisposed()) return;
  if (diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible()) {
    diagrams.code();
  }
  if (doc === current) return;
  if (debugging && doc !== runDocument) { toast('Termina la depuración antes de cambiar de archivo.'); return; }
  if (current) current.viewState = editor.saveViewState();
  current = doc;
  diagrams.changed();
  editor.setModel(doc.model);
  if (doc.viewState) editor.restoreViewState(doc.viewState);
  editor.updateOptions({ readOnly: debugging });
  renderFiles();
  renderOutline();
  renderProblems();
  $('breadcrumb-file').textContent = doc.name;
  updateBreadcrumbSymbol();
  liveManager.onDocumentChange(doc);
  notifyDiscord(true);
  scheduleCheck();
  persistDrafts();
  editor.focus();
}

function renderFiles() {
  const isDiagram = diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible();
  const isDockedDiagram = isDiagram && !(windowManager && windowManager.isDiagramFloating());
  const bc = document.querySelector('.breadcrumbs');
  if (bc) bc.classList.toggle('hidden', isDockedDiagram);

  let tabsHtml = documents.map(d => {
    const isCurrent = d === current;
    if (isCurrent && isDockedDiagram) {
      return `<div class="tab file-tab inactive-while-diagram" role="tab" aria-selected="false" data-doc="${d.id}" title="Código fuente: ${esc(d.name)} · Haz clic para volver al editor">${icon('file-code-2')}<span>${esc(d.name)}</span><span class="tab-code-tag">Código</span><button data-close-doc="${d.id}" title="Cerrar archivo" aria-label="Cerrar ${esc(d.name)}">${isDirty(d) ? '<span class="unsaved">•</span>' : icon('x')}</button></div>`;
    }
    return `<div class="tab ${isCurrent ? 'active' : ''}" role="tab" aria-selected="${isCurrent}" data-doc="${d.id}">${icon('file-code-2')}<span>${esc(d.name)}</span><button data-close-doc="${d.id}" title="Cerrar archivo" aria-label="Cerrar ${esc(d.name)}">${isDirty(d) ? '<span class="unsaved">•</span>' : icon('x')}</button></div>`;
  }).join('');

  if (isDockedDiagram && current) {
    tabsHtml += `<div class="tab diagram-tab active" role="tab" aria-selected="true" id="diagram-active-tab" title="Flujograma de ${esc(current.name)} · Haz clic para volver al código">${icon('workflow')}<span class="diagram-tab-title">Diagrama: ${esc(current.name)}</span><span class="diagram-tab-badge">FLUX</span><button id="close-diagram-tab" title="Volver al código (Esc)" aria-label="Volver al código">${icon('x')}</button></div>`;
  }

  $('tabs').innerHTML = tabsHtml;
  if ($('file-list')) $('file-list').innerHTML = documents.map(d => `<button class="file-item ${d === current ? 'active' : ''}" data-doc="${d.id}">${icon('file-code-2')}${esc(d.name)}${isDirty(d) ? '<span class="dirty">•</span>' : ''}</button>`).join('');
  highlightProjectFile();
  refreshIcons();
}

function renderOutline() {
  $('outline').innerHTML = current ? symbols(current.model.getValue()).map(s => `<button class="outline-item" data-line="${s.line}" title="${esc(s.type)}"><span class="symbol">${s.kind === 'variable' ? 'x' : s.kind === 'main' ? '◇' : 'ƒ'}</span>${esc(s.name)}</button>`).join('') : '';
}

function showLine(line) { diagrams.code(); editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: 1 }); editor.focus(); }

async function closeDocument(id) {
  const doc = documents.find(d => d.id === id); if (!doc) return;
  if (debugging) { toast('Detén la depuración antes de cerrar un archivo.'); return; }
  if (isDirty(doc) && !(await api.confirm(`«${doc.name}» tiene cambios sin guardar. ¿Cerrar y descartar esos cambios?`))) return;
  const index = documents.indexOf(doc); if (index < 0) return;
  documents.splice(index, 1);
  if (current === doc) editor.setModel(null);
  doc.model.dispose();
  if (current === doc) {
    current = null;
    if (documents.length) activate(documents[Math.min(index, documents.length - 1)]);
    else newDocument({ pristine: true });
  }
  renderFiles();
  persistDrafts();
}

async function openFiles() {
  if (!api) return;
  for (const file of await api.open()) {
    const existing = documents.find(d => pathKey(d.path) === pathKey(file.path));
    if (existing) activate(existing);
    else newDocument({ ...file, pristine: true });
  }
}

async function saveFile(saveAs = false) {
  if (!current || !api) return;
  const doc = current;
  const content = doc.model.getValue();
  const result = await api.save({ filePath: doc.path, content, name: doc.name, saveAs });
  if (result) {
    doc.path = result.path;
    doc.name = result.name;
    doc.savedContent = content;
    doc.pristine = true;
    doc.isLiveSession = false;
    renderFiles();
    $('breadcrumb-file').textContent = current.name;
    persistDrafts();
    notifyDiscord(true);
    liveManager.broadcastSave(doc.name);
    toast('Archivo guardado.');
    if (project) await renderProject();
  }
}

async function renderProject() {
  const version = ++projectRenderVersion, owner = project;
  const expanded = new Set(expandedFolders), selected = selectedFolder;
  $('project-name').textContent = project?.name || 'SIN CARPETA';
  $('project-name').title = project?.path || '';
  for (const id of ['project-file','project-folder','project-refresh','project-close']) $(id).disabled = !project;
  $('project-file')?.parentElement?.classList.toggle('hidden', !project);
  applySections();
  if (!owner) { $('project-tree').innerHTML = '<button id="project-empty" class="secondary wide">Abrir carpeta…</button>'; return; }
  async function branch(relative, depth) {
    let entries;
    try { entries = await api.listProject(relative, owner.path); }
    catch (error) {
      if (relative && /ENOENT|ENOTDIR/.test(error.message)) { expandedFolders.delete(relative); return ''; }
      throw error;
    }
    if (version !== projectRenderVersion || project !== owner) return '';
    const rows = [];
    for (const e of entries) {
      const open = expanded.has(e.relative);
      const absolute = owner.path.replace(/[\\/]$/, '') + '/' + e.relative;
      rows.push(`<button class="project-item ${e.directory && selected === e.relative ? 'selected' : ''}" style="padding-left:${12 + depth * 14}px" data-project-path="${esc(e.relative)}" data-directory="${e.directory}" ${e.directory ? '' : `data-file-path="${esc(absolute)}"`} title="${esc(e.relative)}" ${e.directory ? `aria-expanded="${open}"` : ''}>${icon(e.directory ? (open ? 'chevron-down' : 'chevron-right') : 'file-code-2')}${e.directory ? icon('folder') : ''}<span>${esc(e.name)}</span></button>`);
      if (e.directory && open) rows.push(await branch(e.relative, depth + 1));
    }
    return rows.join('');
  }
  try {
    const html = await branch('', 0);
    if (project !== owner || version !== projectRenderVersion) return;
    const scroll = $('project-tree').scrollTop;
    $('project-tree').innerHTML = html || '<p class="side-description">Carpeta vacía. Añade tu primer archivo.</p>';
    $('project-tree').scrollTop = scroll;
    highlightProjectFile();
    refreshIcons();
    persistProjectTree();
  } catch (error) { if (project === owner && version === projectRenderVersion) throw error; }
}

async function openProject() {
  const result = await api.openProject(); if (!result) return;
  navigationVersion++; project = result; restoreProjectTree(); showView('explorer'); await renderProject();
}

async function openProjectFile(relative) {
  if (debugging) { toast('Termina la depuración antes de cambiar de archivo.'); return; }
  const owner = project; if (!owner) return;
  const absolute = owner.path.replace(/[\\/]$/, '') + '/' + relative;
  const existing = documents.find(d => pathKey(d.path) === pathKey(absolute));
  if (existing) { activate(existing); return; }
  const version = ++navigationVersion;
  try {
    const file = await api.readProject(relative, owner.path);
    if (version !== navigationVersion || project !== owner) return;
    const duplicate = documents.find(d => pathKey(d.path) === pathKey(file.path));
    if (duplicate) activate(duplicate); else newDocument({ ...file, pristine: true });
  } catch (error) { if (version === navigationVersion && project === owner) throw error; }
}

async function clickProject(relative, directory) {
  if (!directory) return openProjectFile(relative);
  selectedFolder = relative;
  if (expandedFolders.has(relative)) expandedFolders.delete(relative); else expandedFolders.add(relative);
  await renderProject();
}

function newProjectEntry(directory = false) {
  if (!project) return openProject();
  entryDirectory = directory; $('entry-title').textContent = directory ? 'Nueva carpeta' : 'Nuevo archivo';
  $('entry-name').value = directory ? '' : 'algoritmo.psc'; $('entry-error').textContent = '';
  $('entry-parent').textContent = 'En: ' + project.name + (selectedFolder ? ' / ' + selectedFolder : '');
  $('entry-dialog').showModal(); $('entry-name').focus(); $('entry-name').select();
}

$('entry-form').onsubmit = event => {
  event.preventDefault(); safe(async () => {
    const button = $('entry-form').querySelector('[type="submit"]'); button.disabled = true;
    try {
      const result = await api.createProjectEntry(selectedFolder, $('entry-name').value.trim(), entryDirectory);
      if (selectedFolder) expandedFolders.add(selectedFolder);
      $('entry-dialog').close(); await renderProject(); if (!result.directory) await openProjectFile(result.relative);
    } catch (error) { $('entry-error').textContent = error.message.includes('EEXIST') ? 'Ya existe un archivo o carpeta con ese nombre.' : error.message; }
    finally { button.disabled = false; }
  })();
};

$('open-project').onclick = safe(openProject);
$('project-file').onclick = safe(() => newProjectEntry());
$('project-folder').onclick = safe(() => newProjectEntry(true));
$('project-refresh').onclick = safe(renderProject);
$('project-name').onclick = () => { selectedFolder = ''; safe(renderProject)(); };
$('project-close').onclick = safe(async () => { await api.closeProject(); navigationVersion++; project = null; selectedFolder = ''; expandedFolders.clear(); await renderProject(); });

function showView(view) {
  if (view === 'commands') {
    layout.toggle('commands', true);
    return;
  }
  layout.toggle('sidebar', true);
  for (const v of ['explorer', 'examples', 'extensions']) $(v + '-view').classList.toggle('hidden', v !== view);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('side-title').textContent = { explorer: 'EXPLORADOR', examples: 'APRENDE HACIENDO', extensions: 'EXTENSIONES' }[view] || 'EXPLORADOR';
  $('side-new').classList.toggle('hidden', view !== 'explorer');
}

function showPanel(panel) {
  layout.showTerminal();
  for (const p of ['console', 'problems', 'debug']) $(p + '-panel').classList.toggle('hidden', p !== panel);
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === panel));
}

function renderProblems() {
  const problems = current?.diagnostics || [];
  $('problem-count').textContent = problems.length;
  $('status-errors').textContent = problems.length ? `✕ ${problems.length} error${problems.length === 1 ? '' : 'es'}` : '✓ Sin errores';
  $('status-errors').classList.toggle('has-errors', problems.length > 0);
  $('problems-list').innerHTML = problems.length ? problems.map(p => `<button class="problem" data-line="${p.line}">${icon('circle-x')}<span>${esc(p.message)}</span><small>Lín ${p.line} · ${p.code}</small></button>`).join('') : `<div class="empty-panel">${icon('circle-check')}Sin errores detectados.</div>`;
  refreshIcons();
}

function setDiagnostics(doc, errors) {
  if (doc.model.isDisposed()) return;
  doc.diagnostics = errors;
  monaco.editor.setModelMarkers(doc.model, 'pseint', errors.map(p => ({
    startLineNumber: Math.min(p.line, doc.model.getLineCount()),
    endLineNumber: Math.min(p.line, doc.model.getLineCount()),
    startColumn: 1,
    endColumn: doc.model.getLineMaxColumn(Math.min(p.line, doc.model.getLineCount())),
    severity: monaco.MarkerSeverity.Error,
    message: p.message,
    source: 'PSeInt',
    code: String(p.code)
  })));
  if (doc === current) renderProblems();
}

function scheduleCheck() {
  clearTimeout(checkTimer);
  if (settings.autoCheck && api && !debugging) checkTimer = setTimeout(() => safe(checkCurrent)(), 800);
}

async function checkCurrent() {
  if (!current || !api || debugging) return;
  if (checking) { pendingCheck = true; return; }
  checking = true; const doc = current, version = doc.model.getVersionId(), profile = settings.profile;
  try {
    const errors = await api.check(doc.model.getValue(), profile);
    if (!doc.model.isDisposed() && doc.model.getVersionId() === version && settings.profile === profile) setDiagnostics(doc, errors);
    return errors;
  }
  finally { checking = false; if (pendingCheck) { pendingCheck = false; scheduleCheck(); } }
}

function appendOutput(text, isRemote = false) {
  if (!text) return;
  $('terminal-welcome').classList.add('hidden');
  const node = $('console-output');
  node.textContent = (node.textContent + text).slice(-250_000);
  $('console-panel').scrollTop = $('console-panel').scrollHeight;
  if (!isRemote) {
    liveManager.broadcastTerminalChunk(text);
  }
}

function consumeOutput(chunk) {
  terminalPending += chunk;
  while (terminalPending.length) {
    const start = terminalPending.indexOf('\x1b');
    if (start < 0) { appendOutput(terminalPending); terminalPending = ''; break; }
    if (start > 0) { appendOutput(terminalPending.slice(0, start)); terminalPending = terminalPending.slice(start); }
    if (terminalPending.startsWith('\x1b[zl') || terminalPending.startsWith('\x1b[zk')) {
      inputKind = terminalPending.startsWith('\x1b[zk') ? 'key' : 'line';
      terminalPending = terminalPending.slice(4);
      if (windowManager.isTerminalFloating() || settings.floatingTerminal || settings.uiMode === 'classic-pseint') {
        windowManager.showFloating('terminal');
      } else {
        showPanel('console');
      }
      $('console-input').placeholder = inputKind === 'key' ? 'Pulsa Enter para continuar…' : 'Escribe el dato solicitado y pulsa Enter…';
      $('input-form').classList.remove('hidden'); $('console-input').focus();
      $('console-panel').scrollTop = $('console-panel').scrollHeight;
      $('run-state').textContent = inputKind === 'key' ? 'Esperando una tecla' : 'Esperando un dato · Enter para enviar'; continue;
    }
    if (terminalPending.startsWith('\x1b[zt')) { const end = terminalPending.indexOf('\n'); if (end < 0) break; terminalPending = terminalPending.slice(end + 1); continue; }
    if (/^\x1b\[z[pe]/.test(terminalPending)) { const end = terminalPending.indexOf(';'); if (end < 0) break; terminalPending = terminalPending.slice(end + 1); continue; }
    const ansi = terminalPending.match(/^\x1b\[[0-9;?]*[A-Za-z]/);
    if (ansi) { if (ansi[0] === '\x1b[2J') $('console-output').textContent = ''; terminalPending = terminalPending.slice(ansi[0].length); continue; }
    if (terminalPending.length < 20 && !terminalPending.includes('\n')) break;
    terminalPending = terminalPending.slice(1);
  }
}

async function run(debug = false) {
  if (running) { if (debugging && !debug) await api.debug('continuar'); return; }
  if (!api) { toast('Ejecuta la aplicación de escritorio para utilizar PSeInt.', true); return; }
  const doc = current; const code = doc.model.getValue();
  running = true; $('run').disabled = true; $('debug-run').disabled = true;
  liveManager.broadcastRunState({ running: true, debug });
  try {
    const errors = await api.check(code, settings.profile); setDiagnostics(doc, errors);
    if (errors.length) { showPanel('problems'); throw new Error(settings.profile === 'Estricto' ? 'El perfil Estricto exige otra sintaxis. Si tu ejercicio usa arreglos de tamaño variable o no usa punto y coma, selecciona PSeInt · Flexible y vuelve a ejecutar.' : 'Corrige los errores indicados en Problemas antes de ejecutar.'); }
    if (current !== doc || doc.model.getValue() !== code) throw new Error('El archivo cambió durante la comprobación. Vuelve a ejecutar.');
    debugging = debug; runDocument = doc; runStarted = performance.now(); terminalPending = ''; watchNames = [...new Set(symbols(code).filter(s => s.kind === 'variable').map(s => s.name))].slice(0, 50); watchValues = {};
    notifyDiscord(true);
    $('console-output').textContent = ''; $('terminal-welcome').classList.add('hidden'); $('input-form').classList.add('hidden');
    $('run-state').innerHTML = '<span class="tiny-dot"></span>' + (debug ? 'Depurando' : 'Ejecutando');
    $('stop').classList.remove('hidden'); $('run').classList.add('hidden');
    editor.updateOptions({ readOnly: debug });
    if (windowManager.isTerminalFloating() || settings.floatingTerminal || settings.uiMode === 'classic-pseint') {
      windowManager.showFloating('terminal');
    } else {
      showPanel(debug ? 'debug' : 'console');
    }
    renderVariables();
    await api.run(code, { profile: settings.profile, debug, watches: watchNames });
  } catch (err) { finishRun(); throw err; }
}

function finishRun(result) {
  diagrams.clearDebug();
  running = false; debugging = false; $('run').disabled = false; $('debug-run').disabled = false; $('stop').classList.add('hidden'); $('run').classList.remove('hidden'); $('input-form').classList.add('hidden'); editor.updateOptions({ readOnly: false });
  liveManager.broadcastRunState({ running: false, debug: false });
  notifyDiscord(true);
  if (runDocument && !runDocument.model.isDisposed()) debugDecorations = runDocument.model.deltaDecorations(debugDecorations, []);
  if (result) {
    if (terminalPending) { appendOutput(terminalPending.replace(/\x1b[^\n]*/g, '')); terminalPending = ''; }
    const duration = ((performance.now() - runStarted) / 1000).toFixed(2);
    const state = result.stopped ? 'Detenido' : result.code ? 'Finalizado con error' : 'Finalizado';
    appendOutput(`\n── ${state} · ${duration} s ──\n`); $('run-state').textContent = `${state} · ${duration} s`;
  } else $('run-state').textContent = 'Listo para ejecutar';
  scheduleCheck();
}

function renderVariables() {
  $('variables-list').innerHTML = watchNames.length ? watchNames.map((name, i) => `<div class="variable-row"><span>${esc(name)}</span><span>${esc(watchValues[i + 1] ?? '—')}</span></div>`).join('') : '<p class="muted">Declara variables con Definir para verlas en esta tabla.</p>';
}

function consumeDebug(line) {
  const pos = line.match(/^linea (\d+)/);
  if (pos && runDocument) {
    const lineNumber = Math.max(1, Math.min(runDocument.model.getLineCount(), Number(pos[1])));
    debugDecorations = runDocument.model.deltaDecorations(debugDecorations, [{ range: new monaco.Range(lineNumber, 1, lineNumber, 1), options: { isWholeLine: true, className: 'debug-line', glyphMarginClassName: 'debug-glyph' } }]);
    diagrams.highlight(lineNumber); editor.revealLineInCenterIfOutsideViewport(lineNumber); $('debug-position').textContent = `Línea ${lineNumber}`;
  }
  const value = line.match(/^autoevaluacion (\d+) (.*)$/); if (value) { watchValues[value[1]] = value[2]; renderVariables(); }
  if (line === 'estado pausa') $('run-state').textContent = 'En pausa · F10 para avanzar';
  if (line === 'estado ejecutando') $('run-state').textContent = 'Depurando · en ejecución';
}

function applySettings() {
  const mode = settings.uiMode || 'modern';
  const appEl = $('app') || document.body;
  appEl.classList.remove('ui-mode-modern', 'ui-mode-classic-pseint', 'ui-mode-classic-studio');
  appEl.classList.add('ui-mode-' + mode);
  document.documentElement.classList.remove('ui-mode-modern', 'ui-mode-classic-pseint', 'ui-mode-classic-studio');
  document.documentElement.classList.add('ui-mode-' + mode);

  if ($('ui-mode-select')) $('ui-mode-select').value = mode;

  let themeId = settings.theme;
  if (mode === 'classic-pseint' && (!settings.theme || settings.theme === 'obsidian')) {
    themeId = 'pseint-classic';
  }
  const t = allThemes(extensions).find(t => t.id === themeId) || themes[0];
  for (const [key, value] of Object.entries(t.ui)) document.documentElement.style.setProperty('--' + key, value);
  const accent = settings.accent || t.ui.accent;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-soft', accent + '18');
  document.documentElement.style.colorScheme = t.base === 'vs' ? 'light' : 'dark';
  monaco.editor.setTheme(t.id);
  editor.updateOptions({
    fontFamily: `"${settings.fontFamily.replace(/["\\]/g, '')}", Consolas, monospace`,
    fontSize: settings.fontSize,
    lineHeight: Math.round(settings.fontSize * settings.lineHeight),
    fontLigatures: settings.ligatures,
    minimap: { enabled: settings.minimap },
    stickyScroll: { enabled: settings.stickyScroll !== false, maxLineCount: 5 },
    cursorStyle: settings.cursorStyle || 'line',
    cursorBlinking: settings.cursorBlinking || 'smooth',
    renderWhitespace: settings.renderWhitespace || 'none',
    wordWrap: settings.wordWrap ? 'on' : 'off',
    bracketPairColorization: { enabled: settings.bracketColors },
    padding: { top: mode === 'modern' ? 12 : 6, bottom: mode === 'modern' ? 14 : 6 },
    smoothScrolling: mode === 'modern',
    cursorSmoothCaretAnimation: mode === 'modern' ? 'on' : 'off',
    lineNumbersMinChars: 3
  });
  for (const doc of documents) doc.model.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  $('theme-status').textContent = t.name;
  $('indent-status').textContent = `Espacios: ${settings.tabSize}`;
  $('profile').value = settings.profile;
  if ($('profile-status')) $('profile-status').textContent = settings.profile;
  persistSettings();
}

function renderThemeGrid() {
  $('theme-grid').innerHTML = allThemes(extensions).map(t => `<button class="theme-choice ${settings.theme === t.id ? 'active' : ''}" data-theme="${esc(t.id)}"><span class="theme-preview" style="--preview-bg:${t.ui.editor};--preview-accent:${t.ui.accent};--preview-green:${t.ui.green};--preview-text:${t.ui.text}"><i></i><i></i><i></i><i></i></span>${esc(t.name)}</button>`).join('');
}

function syncSettingsForm() {
  renderThemeGrid();
  document.querySelectorAll('input[name="pref-ui-mode"]').forEach(r => {
    r.checked = (r.value === (settings.uiMode || 'modern'));
  });
  if ($('pref-floating-terminal')) $('pref-floating-terminal').checked = !!settings.floatingTerminal;
  if ($('pref-floating-diagram')) $('pref-floating-diagram').checked = !!settings.floatingDiagram;
  if ($('ui-mode-select')) $('ui-mode-select').value = settings.uiMode || 'modern';
  $('font-family').value = settings.fontFamily;
  $('font-size').value = settings.fontSize;
  $('font-size-label').value = settings.fontSize + ' px';
  $('line-height').value = settings.lineHeight;
  $('line-height-label').value = settings.lineHeight;
  $('tab-size').value = settings.tabSize;
  $('accent-color').value = settings.accent || allThemes(extensions).find(t => t.id === settings.theme)?.ui.accent || themes[0].ui.accent;
  if ($('cursor-style')) $('cursor-style').value = settings.cursorStyle || 'line';
  if ($('cursor-blinking')) $('cursor-blinking').value = settings.cursorBlinking || 'smooth';
  if ($('render-whitespace')) $('render-whitespace').value = settings.renderWhitespace || 'none';
  if ($('settings-username')) $('settings-username').value = localStorage.getItem('pseudostudio_username') || '';
  for (const [id, key] of [
    ['ligatures', 'ligatures'],
    ['minimap', 'minimap'],
    ['sticky-scroll', 'stickyScroll'],
    ['word-wrap', 'wordWrap'],
    ['auto-check', 'autoCheck'],
    ['bracket-colors', 'bracketColors']
  ]) {
    if ($(id)) $(id).checked = settings[key] !== false;
  }
}

function setUiMode(mode) {
  const prevMode = settings.uiMode;
  settings.uiMode = mode;
  if (mode === 'classic-pseint') {
    // En modo clásico PSeInt las ventanas flotantes se abren cuando se ejecuta (F5) o se abre diagrama (F7)
  } else {
    if (prevMode === 'classic-pseint' && settings.theme === 'pseint-classic') {
      settings.theme = 'obsidian';
    }
    if (!settings.floatingTerminal && windowManager.isTerminalFloating()) {
      windowManager.dockTerminal();
    }
    if (!settings.floatingDiagram && windowManager.isDiagramFloating()) {
      windowManager.dockDiagram();
      if (diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible()) {
        $('editor')?.classList.add('hidden');
        $('diagram-view')?.classList.remove('hidden');
      }
    }
  }
  applySettings();
  syncSettingsForm();
  renderFiles();
  toast('Modo de interfaz: ' + (mode === 'modern' ? 'Moderna Studio' : mode === 'classic-pseint' ? 'Clásica PSeInt' : 'Clásica Studio'));
}

function settingsTab(tab) {
  for (const t of ['appearance', 'editor', 'ai']) $('settings-' + t).classList.toggle('hidden', t !== tab);
  document.querySelectorAll('[data-settings-tab]').forEach(b => b.classList.toggle('active', b.dataset.settingsTab === tab));
}

async function showSettings(tab = 'appearance') {
  syncSettingsForm();
  settingsTab(tab);
  $('settings-dialog').showModal();
  if (api) {
    const ai = await api.aiSettings();
    $('ai-url').value = ai.baseUrl;
    $('ai-model').value = ai.model;
    $('ai-key').placeholder = ai.hasKey ? 'Clave guardada · escribe para reemplazarla' : 'Clave opcional para servidores locales';
    $('ai-key').value = '';
    $('ai-clear-key').checked = false;
  }
}

async function loadFont(font) {
  const face = new FontFace(font.name, `url(${font.data})`); await face.load(); document.fonts.add(face);
  if (![...$('font-family').options].some(o => o.value === font.name)) { const option = new Option(font.name, font.name); $('font-family').add(option); }
}

let discordTimer = null;
function notifyDiscord(immediate = false) {
  if (!api?.discordUpdate) return;
  clearTimeout(discordTimer);
  const doUpdate = () => {
    try {
      const pos = editor?.getPosition();
      api.discordUpdate({
        fileName: current?.name || '',
        line: pos ? pos.lineNumber : 1,
        col: pos ? pos.column : 1,
        projectName: project?.name || '',
        isRunning: running,
        isDebug: debugging,
        profile: $('profile-select')?.value || settings.profile || 'Flexible'
      });
    } catch {}
  };
  if (immediate) doUpdate();
  else discordTimer = setTimeout(doUpdate, 350);
}

function getDiscordSvg() {
  return `<svg viewBox="0 0 24 24" class="ext-brand-icon discord" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;
}

function getExtIconHtml(ext) {
  if (ext.id === 'pseudostudio.discord-presence' || ext.icon === 'discord') {
    return getDiscordSvg();
  }
  const iconName = ext.icon || (ext.themes?.length ? 'palette' : ext.snippets?.length ? 'code-2' : 'package');
  return `<i data-lucide="${iconName}"></i>`;
}

function switchExtTab(tab) {
  activeExtTab = tab;
  $('ext-tab-catalog')?.classList.toggle('active', tab === 'catalog');
  $('ext-tab-installed')?.classList.toggle('active', tab === 'installed');
  renderExtensions();
}

function renderExtensions() {
  if (!$('extension-list')) return;

  const installedMap = new Map(extensions.map(e => [e.id, e]));
  if ($('ext-installed-count')) $('ext-installed-count').textContent = extensions.length;

  let list = activeExtTab === 'catalog' ? catalog : extensions;

  if (extSearchQuery) {
    const q = extSearchQuery.toLowerCase();
    list = list.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.author || '').toLowerCase().includes(q)
    );
  }

  if (activeExtTab === 'installed' && list.length === 0) {
    $('extension-list').innerHTML = `
      <div class="ext-empty-state">
        <i data-lucide="package-open"></i>
        <p>Aún no tienes extensiones instaladas.</p>
        <button id="btn-goto-catalog" class="secondary" style="font-size:11px"><i data-lucide="compass"></i> Explorar Catálogo</button>
      </div>`;
    const btn = $('btn-goto-catalog');
    if (btn) btn.onclick = () => switchExtTab('catalog');
    refreshIcons();
    return;
  }

  if (activeExtTab === 'catalog' && list.length === 0) {
    $('extension-list').innerHTML = `
      <div class="ext-empty-state">
        <i data-lucide="search-x"></i>
        <p>No se encontraron extensiones en el catálogo.</p>
      </div>`;
    refreshIcons();
    return;
  }

  $('extension-list').innerHTML = list.map(item => {
    const isInstalled = installedMap.has(item.id);
    const installedItem = installedMap.get(item.id);
    const isEnabled = isInstalled ? (installedItem.enabled !== false) : false;
    const catClass = (item.category || 'General').toLowerCase().replace(/[\s/]+/g, '-');

    let actionsHtml = '';
    if (isInstalled) {
      actionsHtml = `
        <span class="ext-status-tag"><i data-lucide="check"></i> ${isEnabled ? 'Activa' : 'Desactivada'}</span>
        <button class="ext-btn ${isEnabled ? '' : 'primary'}" data-ext-toggle="${esc(item.id)}" data-enabled="${isEnabled}">
          ${isEnabled ? 'Desactivar' : 'Activar'}
        </button>
        <button class="ext-btn danger" data-ext-uninstall="${esc(item.id)}" title="Desinstalar extensión">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    } else {
      actionsHtml = `
        <button class="ext-btn primary" data-ext-install-catalog="${esc(item.id)}">
          <i data-lucide="download"></i> Instalar
        </button>
      `;
    }

    return `
      <article class="ext-card ${isInstalled ? 'installed' : ''}">
        <div class="ext-card-header">
          <div class="ext-icon-box ${catClass}">
            ${getExtIconHtml(item)}
          </div>
          <div class="ext-card-info">
            <div class="ext-card-title-row">
              <h4 class="ext-card-title" title="${esc(item.name)}">${esc(item.name)}</h4>
              <span class="ext-card-ver">v${esc(item.version)}</span>
            </div>
            <div class="ext-card-meta">
              <span>${esc(item.author || 'PseudoStudio')}</span>
              <span class="ext-cat-pill">${esc(item.category || 'General')}</span>
            </div>
          </div>
        </div>
        <p class="ext-card-desc">${esc(item.description)}</p>
        <div class="ext-card-actions">
          ${actionsHtml}
        </div>
      </article>
    `;
  }).join('');

  refreshIcons();
}

function updateExtensions(items) {
  extensions = items || [];
  registerThemes(monaco, extensions);
  if (!allThemes(extensions).some(t => t.id === settings.theme)) settings.theme = 'obsidian';
  applySettings();
  renderExtensions();
  renderThemeGrid();
  notifyDiscord(true);
}

function toggleAI(force) { layout.toggle('ai', force); }

function addAIMessage(role, text) {
  const el = document.createElement('div'); el.className = 'ai-message ' + role;
  const label = document.createElement('strong'); label.textContent = role === 'user' ? 'TÚ' : 'ASISTENTE';
  el.append(label, document.createTextNode(text));
  $('ai-conversation').append(el);
  $('ai-conversation').scrollTop = $('ai-conversation').scrollHeight;
  return el;
}

async function askAI(question = $('ai-question').value.trim()) {
  if (!question || aiBusy) return; toggleAI(true); aiBusy = true; $('ai-send').disabled = true; $('ai-cancel').classList.remove('hidden');
  addAIMessage('user', question); $('ai-question').value = ''; const pending = addAIMessage('assistant', 'Pensando…');
  try { const result = await api.askAI({ question, code: current.model.getValue() }); pending.lastChild.textContent = result; }
  catch (error) { pending.lastChild.textContent = error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
  finally { aiBusy = false; $('ai-send').disabled = false; $('ai-cancel').classList.add('hidden'); $('ai-conversation').scrollTop = $('ai-conversation').scrollHeight; }
}

const commands = [
  ['Interfaz: Cambiar a Moderna Studio', '', () => setUiMode('modern')],
  ['Interfaz: Cambiar a Clásica PSeInt Original', '', () => setUiMode('classic-pseint')],
  ['Interfaz: Cambiar a Clásica PseudoStudio', '', () => setUiMode('classic-studio')],
  ['Ventana: Desacoplar / Acoplar Terminal', 'Ctrl Alt T', () => windowManager.isTerminalFloating() ? windowManager.dockTerminal() : windowManager.popoutTerminal()],
  ['Ventana: Desacoplar / Acoplar Diagrama', 'Ctrl Alt D', () => windowManager.isDiagramFloating() ? windowManager.dockDiagram() : windowManager.popoutDiagram()],
  ['Aula en vivo: Iniciar transmisión o unirse', 'Ctrl Alt L', () => liveManager.showLiveDialog()],
  ['Aula en vivo: Cambiar nombre de usuario', '', () => $('username-dialog').showModal()],
  ['Mostrar / ocultar comandos PSeInt', 'F4', () => layout.toggle('commands')],
  ['Ver flujograma', 'F7', () => diagrams.show()],
  ['Volver al código', '', () => diagrams.code()],
  ['Exportar a otro lenguaje', '', () => $('export-code').click()],
  ['Mostrar / ocultar explorador', 'Ctrl B', () => layout.toggle('sidebar')],
  ['Mostrar / ocultar terminal', 'Ctrl J', () => layout.toggle('terminal')],
  ['Ampliar / restaurar editor', 'Ctrl Shift M', () => layout.focusEditor()],
  ['Distribución de paneles', '', () => $('layout-dialog').showModal()],
  ['Abrir carpeta de proyecto', 'Ctrl Shift O', openProject],
  ['Nuevo archivo en el proyecto', '', () => newProjectEntry()],
  ['Nueva carpeta', '', () => newProjectEntry(true)],
  ['Nuevo archivo', 'Ctrl N', () => newDocument()],
  ['Abrir archivo', 'Ctrl O', openFiles],
  ['Guardar archivo', 'Ctrl S', () => saveFile()],
  ['Guardar como…', 'Ctrl Shift S', () => saveFile(true)],
  ['Cerrar archivo activo', 'Ctrl W', () => current && closeDocument(current.id)],
  ['Ejecutar algoritmo', 'F5', () => run()],
  ['Depurar paso a paso', 'F6', () => run(true)],
  ['Siguiente paso', 'F10', () => api.debug('paso')],
  ['Detener ejecución', 'Shift F5', () => api.stop()],
  ['Formatear documento', 'Shift Alt F', () => editor.getAction('editor.action.formatDocument').run()],
  ['Buscar en el archivo', 'Ctrl F', () => editor.getAction('actions.find').run()],
  ['Reemplazar en el archivo', 'Ctrl H', () => editor.getAction('editor.action.startFindReplaceAction').run()],
  ['Comentar / descomentar línea', 'Ctrl /', () => editor.getAction('editor.action.commentLine').run()],
  ['Mover línea hacia arriba', 'Alt ↑', () => moveLineUp(editor, monaco)],
  ['Mover línea hacia abajo', 'Alt ↓', () => moveLineDown(editor, monaco)],
  ['Duplicar línea hacia arriba', 'Shift Alt ↑', () => copyLineUp(editor, monaco)],
  ['Duplicar línea hacia abajo', 'Shift Alt ↓', () => copyLineDown(editor, monaco)],
  ['Eliminar línea actual', 'Ctrl Shift K', () => deleteLine(editor, monaco)],
  ['Insertar línea debajo', 'Ctrl Enter', () => editor.getAction('editor.action.insertLineAfter')?.run()],
  ['Insertar línea arriba', 'Ctrl Shift Enter', () => editor.getAction('editor.action.insertLineBefore')?.run()],
  ['Seleccionar siguiente coincidencia', 'Ctrl D', () => editor.getAction('editor.action.addSelectionToNextFindMatch')?.run()],
  ['Alternar ajuste de línea (Word Wrap)', 'Alt Z', () => { settings.wordWrap = !settings.wordWrap; applySettings(); syncSettingsForm(); toast('Ajuste de línea: ' + (settings.wordWrap ? 'Activado' : 'Desactivado')); }],
  ['Agregar cursor arriba', 'Ctrl Alt ↑', () => editor.getAction('editor.action.insertCursorAbove')?.run()],
  ['Agregar cursor abajo', 'Ctrl Alt ↓', () => editor.getAction('editor.action.insertCursorBelow')?.run()],
  ['Seleccionar toda la línea', 'Ctrl L', () => editor.getAction('expandLineSelection')?.run()],
  ['Aumentar tamaño de fuente (Zoom +)', 'Ctrl +', () => { settings.fontSize = Math.min(32, settings.fontSize + 1); applySettings(); syncSettingsForm(); }],
  ['Reducir tamaño de fuente (Zoom -)', 'Ctrl -', () => { settings.fontSize = Math.max(10, settings.fontSize - 1); applySettings(); syncSettingsForm(); }],
  ['Restablecer zoom de fuente', 'Ctrl 0', () => { settings.fontSize = 16; applySettings(); syncSettingsForm(); }],
  ['Insertar comando Escribir', '', () => commandsManager.insertCommand('escribir')],
  ['Insertar comando Leer', '', () => commandsManager.insertCommand('leer')],
  ['Insertar comando Asignar', '', () => commandsManager.insertCommand('asignar')],
  ['Insertar comando Si-Entonces', '', () => commandsManager.insertCommand('si')],
  ['Insertar comando Según', '', () => commandsManager.insertCommand('segun')],
  ['Insertar comando Mientras', '', () => commandsManager.insertCommand('mientras')],
  ['Insertar comando Repetir', '', () => commandsManager.insertCommand('repetir')],
  ['Insertar comando Para', '', () => commandsManager.insertCommand('para')],
  ['Insertar comando Función', '', () => commandsManager.insertCommand('funcion')],
  ['Ajustes de apariencia y editor', 'Ctrl ,', () => showSettings()],
  ['Ver ejemplos', '', () => showView('examples')],
  ['Gestionar extensiones', '', () => showView('extensions')],
  ['Abrir asistente IA', '', () => toggleAI(true)],
  ['Configurar IA', '', () => showSettings('ai')],
  ['Comprobar sintaxis', '', checkCurrent],
  ['Acerca de PseudoStudio', '', () => $('help-dialog').showModal()]
];

function renderCommands() {
  const query = $('command-input').value.toLowerCase();
  $('command-list').innerHTML = commands.map((c, i) => [c, i]).filter(([c]) => c[0].toLowerCase().includes(query)).map(([c, i]) => `<button class="command-item" data-command="${i}"><span>${c[0]}</span>${c[1] ? '<kbd>' + c[1] + '</kbd>' : ''}</button>`).join('');
}

function showCommands() {
  $('command-input').value = '';
  renderCommands();
  $('command-dialog').showModal();
  $('command-input').focus();
}

document.addEventListener('click', safe(async event => {
  const target = event.target.closest('button,[data-doc],#diagram-active-tab,#close-diagram-tab'); if (!target) return;
  if (target.id === 'close-diagram-tab' || target.id === 'diagram-active-tab' || target.closest('#diagram-active-tab')) {
    diagrams.code();
    return;
  }
  if (target.id === 'project-empty') return openProject();
  if (target.dataset.projectPath !== undefined) return clickProject(target.dataset.projectPath, target.dataset.directory === 'true');
  if (target.dataset.closeDoc) return closeDocument(target.dataset.closeDoc);
  if (target.dataset.doc) {
    const doc = documents.find(d => d.id === target.dataset.doc);
    if (diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible()) {
      diagrams.code();
      if (doc && doc !== current) activate(doc);
      return;
    }
    return activate(doc);
  }
  if (target.dataset.line) return showLine(Number(target.dataset.line));
  if (target.dataset.view) return showView(target.dataset.view);
  if (target.dataset.panel) return showPanel(target.dataset.panel);
  if (target.dataset.window) return api.window(target.dataset.window);
  if (target.dataset.close) return $(target.dataset.close).close();
  if (target.dataset.settingsTab) return settingsTab(target.dataset.settingsTab);
  if (target.dataset.theme) { settings.theme = target.dataset.theme; settings.accent = null; applySettings(); syncSettingsForm(); return; }
  if (target.dataset.example) { const ex = examples[Number(target.dataset.example)]; newDocument({ name: ex.name, content: ex.code }); showView('explorer'); return; }
  if (target.dataset.extInstallCatalog) {
    const id = target.dataset.extInstallCatalog;
    const res = await api.installCatalogExtension(id);
    catalog = res.catalog || [];
    updateExtensions(res.extensions || []);
    toast('Extensión instalada correctamente.');
    return;
  }
  if (target.dataset.extUninstall) {
    const id = target.dataset.extUninstall;
    const ok = await api.confirm('¿Deseas desinstalar esta extensión?');
    if (!ok) return;
    const res = await api.uninstallExtension(id);
    catalog = res.catalog || [];
    updateExtensions(res.extensions || []);
    toast('Extensión desinstalada.');
    return;
  }
  if (target.dataset.extToggle) {
    const id = target.dataset.extToggle;
    const nextEnabled = target.dataset.enabled !== 'true';
    const res = await api.toggleExtension(id, nextEnabled);
    if (api.catalogExtensions) catalog = await api.catalogExtensions();
    updateExtensions(res);
    toast(nextEnabled ? 'Extensión activada.' : 'Extensión desactivada.');
    return;
  }
  if (target.dataset.extension) return updateExtensions(await api.toggleExtension(target.dataset.extension, target.dataset.enabled !== 'true'));
  if (target.dataset.question) return askAI(target.dataset.question);
  if (target.dataset.command !== undefined) { $('command-dialog').close(); return commands[Number(target.dataset.command)][2](); }
}));

// Middle click on tabs to close
$('tabs').addEventListener('auxclick', safe(async event => {
  if (event.button === 1) {
    const tab = event.target.closest('.tab');
    if (tab && tab.dataset.doc) {
      event.preventDefault();
      await closeDocument(tab.dataset.doc);
    }
  }
}));

$('new-file').onclick = () => newDocument();
$('side-new').onclick = safe(() => project ? newProjectEntry() : newDocument());
$('open-file').onclick = safe(openFiles);
$('save-file').onclick = safe(() => saveFile());
$('format-code').onclick = safe(() => editor.getAction('editor.action.formatDocument').run());
$('run').onclick = safe(() => run());
$('debug-run').onclick = safe(() => run(true));
$('stop').onclick = safe(() => api.stop());
$('debug-step').onclick = safe(() => api.debug('paso'));
$('debug-continue').onclick = safe(() => api.debug('continuar'));
$('debug-pause').onclick = safe(() => api.debug('pausar'));
$('settings-open').onclick = $('theme-status').onclick = safe(() => showSettings());
$('help-open').onclick = () => $('help-dialog').showModal();
$('command-open').onclick = showCommands;
$('tip-examples').onclick = () => showView('examples');
$('ai-toggle').onclick = () => toggleAI();
$('ai-close').onclick = () => toggleAI(false);
$('ai-configure').onclick = safe(() => showSettings('ai'));
$('ai-send').onclick = safe(() => askAI());
$('ai-cancel').onclick = safe(() => api.cancelAI());
$('ai-question').onkeydown = event => { if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); safe(() => askAI())(); } };
$('clear-console').onclick = () => {
  $('console-output').textContent = '';
  if (!running) $('terminal-welcome').classList.remove('hidden');
  liveManager.broadcastTerminalClear();
};
$('input-form').onsubmit = event => { event.preventDefault(); safe(async () => { const text = $('console-input').value; $('input-form').classList.add('hidden'); appendOutput(text + '\n'); $('console-input').value = ''; $('run-state').textContent = debugging ? 'Depurando' : 'Ejecutando'; try { await api.input(text, inputKind); } catch (error) { if (running) { $('input-form').classList.remove('hidden'); $('console-input').value = text; $('console-input').focus(); } throw error; } })(); };

$('profile').onchange = () => {
  settings.profile = $('profile').value;
  if ($('profile-status')) $('profile-status').textContent = settings.profile;
  diagrams.changed();
  persistSettings();
  scheduleCheck();
  notifyDiscord(true);
};

if ($('profile-status')) {
  $('profile-status').onclick = () => {
    settings.profile = settings.profile === 'Flexible' ? 'Estricto' : 'Flexible';
    $('profile').value = settings.profile;
    $('profile-status').textContent = settings.profile;
    diagrams.changed();
    persistSettings();
    scheduleCheck();
    notifyDiscord(true);
    toast(`Perfil cambiado a PSeInt · ${settings.profile}.`);
  };
}

if ($('indent-status')) {
  $('indent-status').onclick = () => {
    settings.tabSize = settings.tabSize === 4 ? 2 : settings.tabSize === 2 ? 8 : 4;
    $('tab-size').value = settings.tabSize;
    applySettings();
    toast(`Tabulación cambiada a ${settings.tabSize} espacios.`);
  };
}

if ($('status-errors')) {
  $('status-errors').onclick = () => showPanel('problems');
}

if ($('commands-status-pill')) {
  $('commands-status-pill').onclick = () => layout.toggle('commands');
}

if ($('activity-commands')) {
  $('activity-commands').onclick = () => layout.toggle('commands');
}

$('command-input').oninput = renderCommands;
$('command-input').onkeydown = event => {
  if (event.key === 'Enter') { event.preventDefault(); document.querySelector('#command-list button')?.click(); }
  if (event.key === 'ArrowDown') { event.preventDefault(); document.querySelector('#command-list button')?.focus(); }
};

for (const [id, key, type] of [
  ['font-family', 'fontFamily', 'string'],
  ['font-size', 'fontSize', 'number'],
  ['line-height', 'lineHeight', 'number'],
  ['tab-size', 'tabSize', 'number'],
  ['accent-color', 'accent', 'string'],
  ['cursor-style', 'cursorStyle', 'string'],
  ['cursor-blinking', 'cursorBlinking', 'string'],
  ['render-whitespace', 'renderWhitespace', 'string'],
  ['sticky-scroll', 'stickyScroll', 'bool'],
  ['ligatures', 'ligatures', 'bool'],
  ['minimap', 'minimap', 'bool'],
  ['word-wrap', 'wordWrap', 'bool'],
  ['auto-check', 'autoCheck', 'bool'],
  ['bracket-colors', 'bracketColors', 'bool']
]) {
  if ($(id)) {
    $(id).addEventListener('input', () => {
      settings[key] = type === 'bool' ? $(id).checked : type === 'number' ? Number($(id).value) : $(id).value;
      applySettings();
      if ($('font-size-label')) $('font-size-label').value = settings.fontSize + ' px';
      if ($('line-height-label')) $('line-height-label').value = settings.lineHeight;
      if (key === 'autoCheck') scheduleCheck();
    });
  }
}

if ($('ui-mode-select')) {
  $('ui-mode-select').onchange = e => setUiMode(e.target.value);
}

document.querySelectorAll('input[name="pref-ui-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) setUiMode(radio.value);
  });
});

if ($('pref-floating-terminal')) {
  $('pref-floating-terminal').addEventListener('change', e => {
    settings.floatingTerminal = e.target.checked;
    persistSettings();
    if (settings.floatingTerminal && !windowManager.isTerminalFloating()) {
      windowManager.popoutTerminal();
    } else if (!settings.floatingTerminal && windowManager.isTerminalFloating()) {
      windowManager.dockTerminal();
    }
  });
}

if ($('pref-floating-diagram')) {
  $('pref-floating-diagram').addEventListener('change', e => {
    settings.floatingDiagram = e.target.checked;
    persistSettings();
    if (settings.floatingDiagram && !windowManager.isDiagramFloating()) {
      windowManager.popoutDiagram();
    } else if (!settings.floatingDiagram && windowManager.isDiagramFloating()) {
      windowManager.dockDiagram();
    }
  });
}

if ($('settings-username')) {
  $('settings-username').addEventListener('input', e => {
    liveManager.setUsername(e.target.value);
  });
}

$('reset-settings').onclick = () => {
  settings = { ...defaults };
  applySettings();
  syncSettingsForm();
  scheduleCheck();
};

$('import-font').onclick = safe(async () => {
  const font = await api.importFont();
  if (font) {
    await loadFont(font);
    settings.fontFamily = font.name;
    applySettings();
    syncSettingsForm();
    toast('Fuente añadida al editor.');
  }
});

$('install-extension').onclick = safe(async () => {
  const items = await api.installExtension();
  if (items) {
    updateExtensions(items);
    toast('Extensión instalada.');
  }
});

$('save-ai').onclick = safe(async () => {
  const c = await api.saveAiSettings({
    baseUrl: $('ai-url').value.trim(),
    model: $('ai-model').value.trim(),
    key: $('ai-key').value,
    clearKey: $('ai-clear-key').checked
  });
  $('ai-key').value = '';
  $('ai-settings-state').textContent = ' Conexión guardada' + (c.hasKey ? ' · clave cifrada' : '');
  toast('Configuración de IA guardada.');
});

editor.onDidChangeCursorPosition(event => {
  $('cursor-position').textContent = `Lín ${event.position.lineNumber}, Col ${event.position.column}`;
  updateBreadcrumbSymbol();
  liveManager.onCursorChange(event.position);
  notifyDiscord();
});

editor.onDidChangeCursorSelection(event => {
  const sel = event.selection;
  if (!sel || (sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn)) {
    $('selection-status').classList.add('hidden');
    $('selection-status').textContent = '';
  } else {
    const model = editor.getModel();
    if (model) {
      const selectedChars = model.getValueInRange(sel).length;
      const lineSpan = Math.abs(sel.endLineNumber - sel.startLineNumber) + 1;
      $('selection-status').textContent = lineSpan > 1
        ? `(${lineSpan} líneas, ${selectedChars} caracteres)`
        : `(${selectedChars} caracteres)`;
      $('selection-status').classList.remove('hidden');
    }
  }
});

// Setup username prompt dialog
if ($('ext-tab-catalog')) {
  $('ext-tab-catalog').onclick = () => switchExtTab('catalog');
}
if ($('ext-tab-installed')) {
  $('ext-tab-installed').onclick = () => switchExtTab('installed');
}
if ($('extension-search')) {
  $('extension-search').oninput = e => {
    extSearchQuery = e.target.value.trim();
    renderExtensions();
  };
}
// El nombre de usuario se solicita directamente en el diálogo de Aula en Vivo sin bloquear el inicio
const storedUser = localStorage.getItem('pseudostudio_username');
if (storedUser) {
  liveManager.setUsername(storedUser);
}

if ($('username-prompt-save')) {
  $('username-prompt-save').onclick = () => {
    const val = $('username-prompt-input')?.value.trim();
    if (val) {
      liveManager.setUsername(val);
      $('username-dialog').close();
      toast(`¡Bienvenido a PseudoStudio, ${val}!`);
    } else {
      toast('Por favor escribe tu nombre de usuario para continuar.', true);
    }
  };
}

window.addEventListener('keydown', event => {
  const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (document.querySelector('dialog[open]')) return;
  let action;

  if (ctrl && event.altKey && key === 'l') action = () => liveManager.showLiveDialog();
  else if (ctrl && event.altKey && (key === 't' || event.code === 'KeyT')) action = () => windowManager.isTerminalFloating() ? windowManager.dockTerminal() : windowManager.popoutTerminal();
  else if (ctrl && event.altKey && (key === 'd' || event.code === 'KeyD')) action = () => windowManager.isDiagramFloating() ? windowManager.dockDiagram() : windowManager.popoutDiagram();
  else if (ctrl && event.shiftKey && (key === 'p' || event.code === 'KeyP')) action = showCommands;
  else if (event.key === 'F1') action = showCommands;
  else if (key === 'f4' || (ctrl && event.altKey && key === 'c')) action = () => layout.toggle('commands');
  else if (event.altKey && !ctrl && (event.key === 'ArrowUp' || event.code === 'ArrowUp')) {
    action = () => {
      if (event.shiftKey) copyLineUp(editor, monaco);
      else moveLineUp(editor, monaco);
    };
  }
  else if (event.altKey && !ctrl && (event.key === 'ArrowDown' || event.code === 'ArrowDown')) {
    action = () => {
      if (event.shiftKey) copyLineDown(editor, monaco);
      else moveLineDown(editor, monaco);
    };
  }
  else if (event.altKey && !ctrl && !event.shiftKey && (key === 'z' || event.code === 'KeyZ')) {
    action = () => {
      settings.wordWrap = !settings.wordWrap;
      applySettings();
      syncSettingsForm();
      toast('Ajuste de línea: ' + (settings.wordWrap ? 'Activado' : 'Desactivado'));
    };
  }
  else if (event.altKey && event.shiftKey && !ctrl && (key === 'f' || event.code === 'KeyF')) {
    action = () => editor.getAction('editor.action.formatDocument')?.run();
  }
  else if (ctrl && event.shiftKey && (key === 'k' || event.code === 'KeyK')) {
    action = () => deleteLine(editor, monaco);
  }
  else if (ctrl && !event.shiftKey && !event.altKey && event.key === 'Enter') {
    action = () => editor.getAction('editor.action.insertLineAfter')?.run();
  }
  else if (ctrl && event.shiftKey && !event.altKey && event.key === 'Enter') {
    action = () => editor.getAction('editor.action.insertLineBefore')?.run();
  }
  else if (ctrl && !event.shiftKey && !event.altKey && (key === 'd' || event.code === 'KeyD')) {
    action = () => editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
  }
  else if (ctrl && !event.shiftKey && !event.altKey && (key === 'l' || event.code === 'KeyL')) {
    action = () => editor.getAction('expandLineSelection')?.run();
  }
  else if (ctrl && event.altKey && (event.key === 'ArrowUp' || event.code === 'ArrowUp')) {
    action = () => editor.getAction('editor.action.insertCursorAbove')?.run();
  }
  else if (ctrl && event.altKey && (event.key === 'ArrowDown' || event.code === 'ArrowDown')) {
    action = () => editor.getAction('editor.action.insertCursorBelow')?.run();
  }
  else if (ctrl && (key === '+' || key === '=')) {
    action = () => {
      settings.fontSize = Math.min(32, settings.fontSize + 1);
      applySettings();
      syncSettingsForm();
    };
  }
  else if (ctrl && (key === '-' || key === '_')) {
    action = () => {
      settings.fontSize = Math.max(10, settings.fontSize - 1);
      applySettings();
      syncSettingsForm();
    };
  }
  else if (ctrl && key === '0') {
    action = () => {
      settings.fontSize = 16;
      applySettings();
      syncSettingsForm();
    };
  }
  else if (ctrl && key === 'w') action = () => current && closeDocument(current.id);
  else if (ctrl && (key === '/' || key === '7')) action = () => editor.getAction('editor.action.commentLine').run();
  else if (ctrl && key === 'b') action = () => layout.toggle('sidebar');
  else if (ctrl && key === 'j') action = () => layout.toggle('terminal');
  else if (ctrl && event.shiftKey && key === 'm') action = () => layout.focusEditor();
  else if (ctrl && key === 's') action = () => liveManager.isSpectating() ? saveFile(true) : saveFile(event.shiftKey);
  else if (ctrl && key === 'o') action = event.shiftKey ? openProject : openFiles;
  else if (ctrl && key === 'n') action = () => newDocument();
  else if (ctrl && key === 'k') action = showCommands;
  else if (ctrl && key === ',') action = () => showSettings();
  else if (key === 'f5') action = () => event.shiftKey ? api.stop() : run();
  else if (key === 'f7') action = () => (diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible()) ? diagrams.code() : diagrams.show();
  else if (key === 'escape' && diagrams && typeof diagrams.isVisible === 'function' && diagrams.isVisible()) action = () => diagrams.code();
  else if (key === 'f6') action = () => run(true);
  else if (key === 'f10') action = () => api.debug('paso');

  if (action) { event.preventDefault(); event.stopPropagation(); safe(action)(); }
}, true);

if (api) {
  api.on('engine:output', consumeOutput);
  api.on('engine:exit', finishRun);
  api.on('engine:debug', consumeDebug);
  api.on('window:closing', safe(async () => {
    persistDrafts();
    if ((documents.some(isDirty) || running) && !(await api.confirm('Hay archivos sin guardar o una ejecución activa. Los borradores se recuperarán al abrir. ¿Cerrar PseudoStudio?'))) return;
    await api.readyToClose();
  }));
}

$('example-list').innerHTML = examples.map((e, i) => `<button class="example-card" data-example="${i}">${icon(e.icon)}<span><b>${e.title}</b><small>${e.description}</small></span></button>`).join('');

const drafts = readStore('drafts', { files: [] });
for (const file of (drafts.files || []).slice(0, 30)) { try { newDocument(file, false); } catch { /* recover valid drafts only */ } }
if (!documents.length) {
  const guideCode = `// =======================================================
//   BIENVENIDO A PSEUDOSTUDIO - GUÍA DE INICIO RÁPIDO
// =======================================================
//
// 1. EJECUTAR TU ALGORITMO:
//    - Presiona F5 o haz clic en "Ejecutar" en la barra superior.
//    - Cuando tu código use "Leer", la terminal te solicitará el dato.
//
// 2. DEPURAR PASO A PASO:
//    - Presiona F6 para depurar y F10 para avanzar paso a paso.
//    - En la pestaña "VARIABLES" verás el estado en tiempo real.
//
// 3. COMANDOS ARRASTRABLES DE PSEINT:
//    - En el panel derecho "COMANDOS" (F4 / Ctrl Alt C) tienes los 9 bloques.
//    - Haz clic o arrástralos (drag & drop) directamente al editor o al diagrama.
//    - Mantén pulsada la tecla Shift al insertar para variantes avanzadas (Sin Saltar).
//
// 4. DIAGRAMA DE FLUJO INTERACTIVO:
//    - Presiona F7 o clic en "Diagrama" para ver el flujograma en tiempo real.
//    - Puedes programar directamente arrastrando comandos al diagrama.
//    - Haz clic en cualquier bloque del diagrama para ir a su línea de código.
//
// 5. AULA EN VIVO (MODO ESPECTADOR):
//    - Clic en "En Vivo" (Ctrl Alt L) para transmitir sesión a tus alumnos
//      o unirte con código de 6 dígitos o escaneando el código QR.
//
// 6. ATAJOS PROFESIONALES ESTILO VS CODE:
//    - Alt + ↑ / ↓ : Mover línea o bloque hacia arriba / abajo.
//    - Shift + Alt + ↑ / ↓ : Duplicar línea hacia arriba / abajo.
//    - Ctrl + Shift + K : Eliminar línea actual.
//    - Ctrl + D : Multicursor (seleccionar siguiente coincidencia).
//    - Alt + Z : Ajuste de línea automático.
//
// 7. INTERFACES Y VENTANAS:
//    - En el menú superior puedes cambiar entre:
//      "Moderna Studio", "Clásica PSeInt Original" o "Clásica Studio".
//    - Desacopla la terminal o diagrama arrastrando su cabecera (Ctrl Alt T / D).
//
// =======================================================

Algoritmo GuiaInicio
\tEscribir "¡Hola, bienvenido a PseudoStudio!"
\tEscribir "Abre la pestaña 'sin_titulo.psc' para comenzar a programar."
FinAlgoritmo
`;

  const emptyCode = `Algoritmo SinTitulo
\t
FinAlgoritmo
`;

  newDocument({ name: 'sin_titulo.psc', content: emptyCode, pristine: true }, true);
  newDocument({ name: 'Guia_PseudoStudio.psc', content: guideCode, pristine: true }, false);
}
const active = documents.find(d => d.id === drafts.active) || documents[0]; if (active) activate(active);

applySettings();
applySections();
refreshIcons();

if (api) safe(async () => {
  const initial = await api.init();
  if (!project) { project = initial.project; restoreProjectTree(); }
  await renderProject();
  fonts = initial.fonts;
  for (const font of fonts) await loadFont(font).catch(() => {});
  catalog = initial.catalog || [];
  updateExtensions(initial.extensions || []);
  await document.fonts.ready;
  monaco.editor.remeasureFonts();
  scheduleCheck();
  notifyDiscord(true);
})();
else toast('Vista de interfaz. Abre PseudoStudio.exe para ejecutar algoritmos.');
