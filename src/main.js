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
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { createIcons, icons } from 'lucide';
import { themes, registerThemes, allThemes } from './themes';
import { setupLanguage, symbols } from './language';
import { examples } from './examples';
import './style.css';
import { createLayout } from './layout';
import { createDiagrams } from './diagrams';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
const $ = id => document.getElementById(id);
const api = window.studio;
const icon = name => `<i data-lucide="${name}"></i>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const defaults = { theme: 'obsidian', fontFamily: 'Comic Mono', fontSize: 16, lineHeight: 1.7, tabSize: 4, minimap: true, wordWrap: false, autoCheck: true, bracketColors: true, ligatures: false, accent: null, profile: 'Flexible' };
let settings = { ...defaults, ...readStore('settings', {}) };
let extensions = [], fonts = [], documents = [], current = null, counter = 1, running = false, debugging = false, runDocument = null, runStarted = 0, checking = false, pendingCheck = false, aiBusy = false;
let debugDecorations = [], watchNames = [], watchValues = {}, checkTimer, draftTimer, toastTimer;
let terminalPending = '', inputKind = 'line';
let project = null, selectedFolder = '', entryDirectory = false;
const expandedFolders = new Set();
let projectRenderVersion = 0, navigationVersion = 0;
const sectionState = readStore('explorerSections', { project: true, files: true, outline: true });
const pathKey = value => String(value || '').replace(/\\/g, '/').toLowerCase();
function applySections() {
  for (const [name, content] of [['project','project-tree'], ['files','file-list'], ['outline','outline']]) {
    $(name + '-toggle').setAttribute('aria-expanded', String(sectionState[name] !== false));
    $(content).classList.toggle('hidden', sectionState[name] === false);
  }
}
for (const name of ['project', 'files', 'outline']) $(name + '-toggle').onclick = () => {
  sectionState[name] = sectionState[name] === false;
  localStorage.setItem('explorerSections', JSON.stringify(sectionState)); applySections();
};
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
function toast(message, error = false) { $('toast').textContent = String(message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); $('toast').classList.toggle('error', error); $('toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), error ? 6500 : 3300); }
const safe = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(err => toast(err.message, true));
function persistSettings() { try { localStorage.setItem('settings', JSON.stringify(settings)); } catch { toast('No se pudieron guardar los ajustes locales.', true); } }
function persistDrafts() {
  try { localStorage.setItem('drafts', JSON.stringify({ active: current?.id, files: documents.map(d => ({ id: d.id, name: d.name, path: d.path, content: d.model.getValue(), savedContent: d.savedContent, pristine: d.pristine })) })); }
  catch { toast('No hay espacio para recuperar todos los borradores. Guarda tus archivos.', true); }
}
setupLanguage(monaco, () => extensions, () => settings.tabSize);
registerThemes(monaco);
const editor = monaco.editor.create($('editor'), { language: 'pseint', theme: 'obsidian', automaticLayout: true, fontFamily: '"Comic Mono", Consolas, monospace', fontSize: 16, lineHeight: 27, padding: { top: 19, bottom: 24 }, minimap: { enabled: true, scale: 1, maxColumn: 90, renderCharacters: false }, scrollBeyondLastLine: false, smoothScrolling: true, cursorSmoothCaretAnimation: 'on', renderLineHighlight: 'all', lineNumbersMinChars: 4, glyphMargin: true, overviewRulerBorder: false, tabSize: 4, insertSpaces: true, suggest: { showWords: false, preview: true }, quickSuggestions: { other: true, comments: false, strings: false }, bracketPairColorization: { enabled: true }, guides: { indentation: true }, fixedOverflowWidgets: true, contextmenu: true });

const layout = createLayout();
const diagrams = createDiagrams({api, getDocument:()=>current?{id:current.id,name:current.name,content:current.model.getValue()}:null, getProfile:()=>settings.profile, onProblems:errors=>{if(current)setDiagnostics(current,errors);}, onLine:showLine, toast});

function isDirty(d) { return d.model.getValue() !== d.savedContent || (!d.path && !d.pristine); }
function newDocument({ name = `algoritmo${counter++}.psc`, content = 'Algoritmo MiAlgoritmo\n    \nFinAlgoritmo\n', path = null, id = crypto.randomUUID(), savedContent = content, pristine = false } = {}, activateNow = true) {
  if (debugging) { toast('Termina la depuración antes de cambiar de archivo.'); return; }
  const model = monaco.editor.createModel(content, 'pseint', monaco.Uri.parse(`inmemory://studio/${id}/${encodeURIComponent(name)}`));
  model.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  const doc = { id, name, path, model, savedContent, pristine, diagnostics: [] };
  model.onDidChangeContent(() => { if(current?.model===model)diagrams.changed(); renderFiles(); renderOutline(); clearTimeout(draftTimer); draftTimer = setTimeout(persistDrafts, 400); scheduleCheck(); });
  documents.push(doc); if (activateNow) activate(doc); return doc;
}
function activate(doc) {
  navigationVersion++;
  if (!doc || doc.model.isDisposed()) return;
  if (doc === current) return;
  if (debugging && doc !== runDocument) { toast('Termina la depuración antes de cambiar de archivo.'); return; }
  if (current) current.viewState = editor.saveViewState();
  current = doc; diagrams.changed(); editor.setModel(doc.model); if (doc.viewState) editor.restoreViewState(doc.viewState);
  editor.updateOptions({ readOnly: debugging });
  renderFiles(); renderOutline(); renderProblems(); $('breadcrumb-file').textContent = doc.name; scheduleCheck(); persistDrafts(); editor.focus();
}
function renderFiles() {
  $('tabs').innerHTML = documents.map(d => `<div class="tab ${d === current ? 'active' : ''}" role="tab" aria-selected="${d === current}" data-doc="${d.id}">${icon('file-code-2')}<span>${esc(d.name)}</span><button data-close-doc="${d.id}" title="Cerrar archivo" aria-label="Cerrar ${esc(d.name)}">${isDirty(d) ? '<span class="unsaved">•</span>' : icon('x')}</button></div>`).join('');
  $('file-list').innerHTML = documents.map(d => `<button class="file-item ${d === current ? 'active' : ''}" data-doc="${d.id}">${icon('file-code-2')}${esc(d.name)}${isDirty(d) ? '<span class="dirty">•</span>' : ''}</button>`).join('');
  highlightProjectFile(); refreshIcons();
}
function renderOutline() {
  $('outline').innerHTML = current ? symbols(current.model.getValue()).map(s => `<button class="outline-item" data-line="${s.line}" title="${esc(s.type)}"><span class="symbol">${s.kind === 'variable' ? 'x' : s.kind === 'main' ? '◇' : 'ƒ'}</span>${esc(s.name)}</button>`).join('') : '';
}
function showLine(line) { diagrams.code(); editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: 1 }); editor.focus(); }
async function closeDocument(id) {
  const doc = documents.find(d => d.id === id); if (!doc) return;
  if (debugging) { toast('Detén la depuración antes de cerrar un archivo.'); return; }
  if (isDirty(doc) && !(await api.confirm(`«${doc.name}» tiene cambios sin guardar. ¿Cerrar y descartar esos cambios?`))) return;
  const index = documents.indexOf(doc); if (index < 0) return; documents.splice(index, 1); if (current === doc) editor.setModel(null); doc.model.dispose();
  if (current === doc) { current = null; if (documents.length) activate(documents[Math.min(index, documents.length - 1)]); else newDocument({ pristine: true }); }
  renderFiles(); persistDrafts();
}
async function openFiles() { if (!api) return; for (const file of await api.open()) { const existing = documents.find(d => pathKey(d.path) === pathKey(file.path)); if (existing) activate(existing); else newDocument({ ...file, pristine: true }); } }
async function saveFile(saveAs = false) {
  if (!current || !api) return; const doc = current; const content = doc.model.getValue();
  const result = await api.save({ filePath: doc.path, content, name: doc.name, saveAs });
  if (result) { doc.path = result.path; doc.name = result.name; doc.savedContent = content; doc.pristine = true; renderFiles(); $('breadcrumb-file').textContent = current.name; persistDrafts(); toast('Archivo guardado.'); if (project) await renderProject(); }
}
async function renderProject() {
  const version = ++projectRenderVersion, owner = project;
  const expanded = new Set(expandedFolders), selected = selectedFolder;
  $('project-name').textContent = project?.name || 'SIN CARPETA';
  $('project-name').title = project?.path || '';
  for (const id of ['project-file','project-folder','project-refresh','project-close']) $(id).disabled = !project;
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
    highlightProjectFile(); refreshIcons(); persistProjectTree();
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
$('entry-form').onsubmit = event => { event.preventDefault(); safe(async () => {
  const button = $('entry-form').querySelector('[type="submit"]'); button.disabled = true;
  try {
    const result = await api.createProjectEntry(selectedFolder, $('entry-name').value.trim(), entryDirectory);
    if (selectedFolder) expandedFolders.add(selectedFolder);
    $('entry-dialog').close(); await renderProject(); if (!result.directory) await openProjectFile(result.relative);
  } catch (error) { $('entry-error').textContent = error.message.includes('EEXIST') ? 'Ya existe un archivo o carpeta con ese nombre.' : error.message; }
  finally { button.disabled = false; }
})(); };
$('open-project').onclick = safe(openProject);
$('project-file').onclick = safe(() => newProjectEntry());
$('project-folder').onclick = safe(() => newProjectEntry(true));
$('project-refresh').onclick = safe(renderProject);
$('project-name').onclick = () => { selectedFolder = ''; safe(renderProject)(); };
$('project-close').onclick = safe(async () => { await api.closeProject(); navigationVersion++; project = null; selectedFolder = ''; expandedFolders.clear(); await renderProject(); });
function showView(view) {
  layout.toggle('sidebar', true);
  for (const v of ['explorer', 'examples', 'extensions']) $(v + '-view').classList.toggle('hidden', v !== view);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('side-title').textContent = { explorer: 'EXPLORADOR', examples: 'APRENDE HACIENDO', extensions: 'EXTENSIONES' }[view];
  $('side-new').classList.toggle('hidden', view !== 'explorer');
}
function showPanel(panel) { layout.showTerminal(); for (const p of ['console', 'problems', 'debug']) $(p + '-panel').classList.toggle('hidden', p !== panel); document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === panel)); }
function renderProblems() {
  const problems = current?.diagnostics || []; $('problem-count').textContent = problems.length; $('status-errors').textContent = problems.length ? `${problems.length} error${problems.length === 1 ? '' : 'es'}` : '✓ Sin errores';
  $('status-errors').style.color = problems.length ? 'var(--red)' : '';
  $('problems-list').innerHTML = problems.length ? problems.map(p => `<button class="problem" data-line="${p.line}">${icon('circle-x')}<span>${esc(p.message)}</span><small>Lín ${p.line} · ${p.code}</small></button>`).join('') : `<div class="empty-panel">${icon('circle-check')}Sin errores detectados.</div>`;
  refreshIcons();
}
function setDiagnostics(doc, errors) {
  if (doc.model.isDisposed()) return;
  doc.diagnostics = errors;
  monaco.editor.setModelMarkers(doc.model, 'pseint', errors.map(p => ({ startLineNumber: Math.min(p.line, doc.model.getLineCount()), endLineNumber: Math.min(p.line, doc.model.getLineCount()), startColumn: 1, endColumn: doc.model.getLineMaxColumn(Math.min(p.line, doc.model.getLineCount())), severity: monaco.MarkerSeverity.Error, message: p.message, source: 'PSeInt', code: String(p.code) })));
  if (doc === current) renderProblems();
}
function scheduleCheck() { clearTimeout(checkTimer); if (settings.autoCheck && api && !debugging) checkTimer = setTimeout(() => safe(checkCurrent)(), 800); }
async function checkCurrent() {
  if (!current || !api || debugging) return;
  if (checking) { pendingCheck = true; return; }
  checking = true; const doc = current, version = doc.model.getVersionId(), profile = settings.profile;
  try { const errors = await api.check(doc.model.getValue(), profile); if (!doc.model.isDisposed() && doc.model.getVersionId() === version && settings.profile === profile) setDiagnostics(doc, errors); return errors; }
  finally { checking = false; if (pendingCheck) { pendingCheck = false; scheduleCheck(); } }
}
function appendOutput(text) {
  $('terminal-welcome').classList.add('hidden');
  const node = $('console-output'); node.textContent = (node.textContent + text).slice(-250_000); $('console-panel').scrollTop = $('console-panel').scrollHeight;
}
function consumeOutput(chunk) {
  terminalPending += chunk;
  // Handle PSeInt terminal protocol even when escape sequences arrive across chunks.
  while (terminalPending.length) {
    const start = terminalPending.indexOf('\x1b');
    if (start < 0) { appendOutput(terminalPending); terminalPending = ''; break; }
    if (start > 0) { appendOutput(terminalPending.slice(0, start)); terminalPending = terminalPending.slice(start); }
    if (terminalPending.startsWith('\x1b[zl') || terminalPending.startsWith('\x1b[zk')) {
      inputKind = terminalPending.startsWith('\x1b[zk') ? 'key' : 'line';
      terminalPending = terminalPending.slice(4); showPanel('console');
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
  try {
    const errors = await api.check(code, settings.profile); setDiagnostics(doc, errors);
    if (errors.length) { showPanel('problems'); throw new Error(settings.profile === 'Estricto' ? 'El perfil Estricto exige otra sintaxis. Si tu ejercicio usa arreglos de tamaño variable o no usa punto y coma, selecciona PSeInt · Flexible y vuelve a ejecutar.' : 'Corrige los errores indicados en Problemas antes de ejecutar.'); }
    if (current !== doc || doc.model.getValue() !== code) throw new Error('El archivo cambió durante la comprobación. Vuelve a ejecutar.');
    debugging = debug; runDocument = doc; runStarted = performance.now(); terminalPending = ''; watchNames = [...new Set(symbols(code).filter(s => s.kind === 'variable').map(s => s.name))].slice(0, 50); watchValues = {};
    $('console-output').textContent = ''; $('terminal-welcome').classList.add('hidden'); $('input-form').classList.add('hidden');
    $('run-state').innerHTML = '<span class="tiny-dot"></span>' + (debug ? 'Depurando' : 'Ejecutando');
    $('stop').classList.remove('hidden'); $('run').classList.add('hidden');
    editor.updateOptions({ readOnly: debug }); showPanel(debug ? 'debug' : 'console'); renderVariables();
    await api.run(code, { profile: settings.profile, debug, watches: watchNames });
  } catch (err) { finishRun(); throw err; }
}
function finishRun(result) {
  diagrams.clearDebug();
  running = false; debugging = false; $('run').disabled = false; $('debug-run').disabled = false; $('stop').classList.add('hidden'); $('run').classList.remove('hidden'); $('input-form').classList.add('hidden'); editor.updateOptions({ readOnly: false });
  if (runDocument && !runDocument.model.isDisposed()) debugDecorations = runDocument.model.deltaDecorations(debugDecorations, []);
  if (result) {
    if (terminalPending) { appendOutput(terminalPending.replace(/\x1b[^\n]*/g, '')); terminalPending = ''; }
    const duration = ((performance.now() - runStarted) / 1000).toFixed(2);
    const state = result.stopped ? 'Detenido' : result.code ? 'Finalizado con error' : 'Finalizado';
    appendOutput(`\n── ${state} · ${duration} s ──\n`); $('run-state').textContent = `${state} · ${duration} s`;
  } else $('run-state').textContent = 'Listo para ejecutar';
  scheduleCheck();
}
function renderVariables() { $('variables-list').innerHTML = watchNames.length ? watchNames.map((name, i) => `<div class="variable-row"><span>${esc(name)}</span><span>${esc(watchValues[i + 1] ?? '—')}</span></div>`).join('') : '<p class="muted">Declara variables con Definir para verlas en esta tabla.</p>'; }
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
  const t = allThemes(extensions).find(t => t.id === settings.theme) || themes[0];
  for (const [key, value] of Object.entries(t.ui)) document.documentElement.style.setProperty('--' + key, value);
  const accent = settings.accent || t.ui.accent; document.documentElement.style.setProperty('--accent', accent); document.documentElement.style.setProperty('--accent-soft', accent + '18');
  document.documentElement.style.colorScheme = t.base === 'vs' ? 'light' : 'dark';
  monaco.editor.setTheme(t.id);
  editor.updateOptions({ fontFamily: `"${settings.fontFamily.replace(/["\\]/g, '')}", Consolas, monospace`, fontSize: settings.fontSize, lineHeight: Math.round(settings.fontSize * settings.lineHeight), fontLigatures: settings.ligatures, minimap: { enabled: settings.minimap }, wordWrap: settings.wordWrap ? 'on' : 'off', bracketPairColorization: { enabled: settings.bracketColors } });
  for (const doc of documents) doc.model.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  $('theme-status').textContent = t.name; $('indent-status').textContent = `Espacios: ${settings.tabSize}`; $('profile').value = settings.profile;
  persistSettings();
}
function renderThemeGrid() {
  $('theme-grid').innerHTML = allThemes(extensions).map(t => `<button class="theme-choice ${settings.theme === t.id ? 'active' : ''}" data-theme="${esc(t.id)}"><span class="theme-preview" style="--preview-bg:${t.ui.editor};--preview-accent:${t.ui.accent};--preview-green:${t.ui.green};--preview-text:${t.ui.text}"><i></i><i></i><i></i><i></i></span>${esc(t.name)}</button>`).join('');
}
function syncSettingsForm() {
  renderThemeGrid();
  $('font-family').value = settings.fontFamily; $('font-size').value = settings.fontSize; $('font-size-label').value = settings.fontSize + ' px'; $('line-height').value = settings.lineHeight; $('line-height-label').value = settings.lineHeight;
  $('tab-size').value = settings.tabSize; $('accent-color').value = settings.accent || allThemes(extensions).find(t => t.id === settings.theme)?.ui.accent || themes[0].ui.accent;
  for (const [id, key] of [['ligatures','ligatures'],['minimap','minimap'],['word-wrap','wordWrap'],['auto-check','autoCheck'],['bracket-colors','bracketColors']]) $(id).checked = settings[key];
}
function settingsTab(tab) { for (const t of ['appearance', 'editor', 'ai']) $('settings-' + t).classList.toggle('hidden', t !== tab); document.querySelectorAll('[data-settings-tab]').forEach(b => b.classList.toggle('active', b.dataset.settingsTab === tab)); }
async function showSettings(tab = 'appearance') {
  syncSettingsForm(); settingsTab(tab); $('settings-dialog').showModal();
  if (api) { const ai = await api.aiSettings(); $('ai-url').value = ai.baseUrl; $('ai-model').value = ai.model; $('ai-key').placeholder = ai.hasKey ? 'Clave guardada · escribe para reemplazarla' : 'Clave opcional para servidores locales'; $('ai-key').value = ''; $('ai-clear-key').checked = false; }
}
async function loadFont(font) {
  const face = new FontFace(font.name, `url(${font.data})`); await face.load(); document.fonts.add(face);
  if (![...$('font-family').options].some(o => o.value === font.name)) { const option = new Option(font.name, font.name); $('font-family').add(option); }
}
function renderExtensions() {
  $('extension-list').innerHTML = extensions.map(e => `<article class="extension-card"><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p><footer><span>v${esc(e.version)}</span><button data-extension="${esc(e.id)}" data-enabled="${e.enabled}">${e.enabled ? 'Desactivar' : 'Activar'}</button></footer></article>`).join('');
}
function updateExtensions(items) { extensions = items; registerThemes(monaco, extensions); if (!allThemes(extensions).some(t => t.id === settings.theme)) settings.theme = 'obsidian'; applySettings(); renderExtensions(); renderThemeGrid(); }
function toggleAI(force) { layout.toggle('ai', force); }
function addAIMessage(role, text) { const el = document.createElement('div'); el.className = 'ai-message ' + role; const label = document.createElement('strong'); label.textContent = role === 'user' ? 'TÚ' : 'ASISTENTE'; el.append(label, document.createTextNode(text)); $('ai-conversation').append(el); $('ai-conversation').scrollTop = $('ai-conversation').scrollHeight; return el; }
async function askAI(question = $('ai-question').value.trim()) {
  if (!question || aiBusy) return; toggleAI(true); aiBusy = true; $('ai-send').disabled = true; $('ai-cancel').classList.remove('hidden');
  addAIMessage('user', question); $('ai-question').value = ''; const pending = addAIMessage('assistant', 'Pensando…');
  try { const result = await api.askAI({ question, code: current.model.getValue() }); pending.lastChild.textContent = result; }
  catch (error) { pending.lastChild.textContent = error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
  finally { aiBusy = false; $('ai-send').disabled = false; $('ai-cancel').classList.add('hidden'); $('ai-conversation').scrollTop = $('ai-conversation').scrollHeight; }
}
const commands = [
  ['Ver flujograma', 'F7', () => diagrams.show()], ['Volver al código', '', () => diagrams.code()], ['Exportar a otro lenguaje', '', () => $('export-code').click()],
  ['Mostrar / ocultar explorador', 'Ctrl B', () => layout.toggle('sidebar')], ['Mostrar / ocultar terminal', 'Ctrl J', () => layout.toggle('terminal')], ['Ampliar / restaurar editor', 'Ctrl Shift M', () => layout.focusEditor()], ['Distribución de paneles', '', () => $('layout-dialog').showModal()],
  ['Abrir carpeta de proyecto', 'Ctrl Shift O', openProject], ['Nuevo archivo en el proyecto', '', () => newProjectEntry()], ['Nueva carpeta', '', () => newProjectEntry(true)],
  ['Nuevo archivo', 'Ctrl N', () => newDocument()], ['Abrir archivo', 'Ctrl O', openFiles], ['Guardar archivo', 'Ctrl S', () => saveFile()], ['Guardar como…', 'Ctrl Shift S', () => saveFile(true)], ['Ejecutar algoritmo', 'F5', () => run()], ['Depurar paso a paso', 'F6', () => run(true)], ['Siguiente paso', 'F10', () => api.debug('paso')], ['Detener ejecución', 'Shift F5', () => api.stop()], ['Formatear documento', 'Shift Alt F', () => editor.getAction('editor.action.formatDocument').run()], ['Buscar en el archivo', 'Ctrl F', () => editor.getAction('actions.find').run()], ['Ajustes de apariencia', 'Ctrl ,', () => showSettings()], ['Ver ejemplos', '', () => showView('examples')], ['Gestionar extensiones', '', () => showView('extensions')], ['Abrir asistente IA', '', () => toggleAI(true)], ['Configurar IA', '', () => showSettings('ai')], ['Comprobar sintaxis', '', checkCurrent], ['Acerca de PseudoStudio', '', () => $('help-dialog').showModal()]
];
function renderCommands() { const query = $('command-input').value.toLowerCase(); $('command-list').innerHTML = commands.map((c, i) => [c, i]).filter(([c]) => c[0].toLowerCase().includes(query)).map(([c, i]) => `<button class="command-item" data-command="${i}"><span>${c[0]}</span>${c[1] ? '<kbd>' + c[1] + '</kbd>' : ''}</button>`).join(''); }
function showCommands() { $('command-input').value = ''; renderCommands(); $('command-dialog').showModal(); $('command-input').focus(); }

document.addEventListener('click', safe(async event => {
  const target = event.target.closest('button,[data-doc]'); if (!target) return;
  if (target.id === 'project-empty') return openProject();
  if (target.dataset.projectPath !== undefined) return clickProject(target.dataset.projectPath, target.dataset.directory === 'true');
  if (target.dataset.closeDoc) return closeDocument(target.dataset.closeDoc);
  if (target.dataset.doc) return activate(documents.find(d => d.id === target.dataset.doc));
  if (target.dataset.line) return showLine(Number(target.dataset.line));
  if (target.dataset.view) return showView(target.dataset.view);
  if (target.dataset.panel) return showPanel(target.dataset.panel);
  if (target.dataset.window) return api.window(target.dataset.window);
  if (target.dataset.close) return $(target.dataset.close).close();
  if (target.dataset.settingsTab) return settingsTab(target.dataset.settingsTab);
  if (target.dataset.theme) { settings.theme = target.dataset.theme; settings.accent = null; applySettings(); syncSettingsForm(); return; }
  if (target.dataset.example) { const ex = examples[Number(target.dataset.example)]; newDocument({ name: ex.name, content: ex.code }); showView('explorer'); return; }
  if (target.dataset.extension) return updateExtensions(await api.toggleExtension(target.dataset.extension, target.dataset.enabled !== 'true'));
  if (target.dataset.question) return askAI(target.dataset.question);
  if (target.dataset.command !== undefined) { $('command-dialog').close(); return commands[Number(target.dataset.command)][2](); }
}));
$('new-file').onclick = () => newDocument();
$('side-new').onclick = safe(() => project ? newProjectEntry() : newDocument());
$('open-file').onclick = safe(openFiles); $('save-file').onclick = safe(() => saveFile());
$('format-code').onclick = safe(() => editor.getAction('editor.action.formatDocument').run());
$('run').onclick = safe(() => run()); $('debug-run').onclick = safe(() => run(true)); $('stop').onclick = safe(() => api.stop());
$('debug-step').onclick = safe(() => api.debug('paso')); $('debug-continue').onclick = safe(() => api.debug('continuar')); $('debug-pause').onclick = safe(() => api.debug('pausar'));
$('settings-open').onclick = $('theme-status').onclick = safe(() => showSettings()); $('help-open').onclick = () => $('help-dialog').showModal(); $('command-open').onclick = showCommands;
$('tip-examples').onclick = () => showView('examples');
$('ai-toggle').onclick = () => toggleAI(); $('ai-close').onclick = () => toggleAI(false); $('ai-configure').onclick = safe(() => showSettings('ai'));
$('ai-send').onclick = safe(() => askAI()); $('ai-cancel').onclick = safe(() => api.cancelAI());
$('ai-question').onkeydown = event => { if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); safe(() => askAI())(); } };
$('clear-console').onclick = () => { $('console-output').textContent = ''; if (!running) $('terminal-welcome').classList.remove('hidden'); };
$('input-form').onsubmit = event => { event.preventDefault(); safe(async () => { const text = $('console-input').value; $('input-form').classList.add('hidden'); appendOutput(text + '\n'); $('console-input').value = ''; $('run-state').textContent = debugging ? 'Depurando' : 'Ejecutando'; try { await api.input(text, inputKind); } catch (error) { if (running) { $('input-form').classList.remove('hidden'); $('console-input').value = text; $('console-input').focus(); } throw error; } })(); };
$('profile').onchange = () => { settings.profile = $('profile').value; diagrams.changed(); persistSettings(); scheduleCheck(); };
$('command-input').oninput = renderCommands;
$('command-input').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); document.querySelector('#command-list button')?.click(); } if (event.key === 'ArrowDown') { event.preventDefault(); document.querySelector('#command-list button')?.focus(); } };
for (const [id, key, type] of [['font-family','fontFamily','string'],['font-size','fontSize','number'],['line-height','lineHeight','number'],['tab-size','tabSize','number'],['accent-color','accent','string'],['ligatures','ligatures','bool'],['minimap','minimap','bool'],['word-wrap','wordWrap','bool'],['auto-check','autoCheck','bool'],['bracket-colors','bracketColors','bool']]) {
  $(id).addEventListener('input', () => { settings[key] = type === 'bool' ? $(id).checked : type === 'number' ? Number($(id).value) : $(id).value; applySettings(); $('font-size-label').value = settings.fontSize + ' px'; $('line-height-label').value = settings.lineHeight; if (key === 'autoCheck') scheduleCheck(); });
}
$('reset-settings').onclick = () => { settings = { ...defaults }; applySettings(); syncSettingsForm(); scheduleCheck(); };
$('import-font').onclick = safe(async () => { const font = await api.importFont(); if (font) { await loadFont(font); settings.fontFamily = font.name; applySettings(); syncSettingsForm(); toast('Fuente añadida al editor.'); } });
$('install-extension').onclick = safe(async () => { const items = await api.installExtension(); if (items) { updateExtensions(items); toast('Extensión instalada.'); } });
$('save-ai').onclick = safe(async () => { const c = await api.saveAiSettings({ baseUrl: $('ai-url').value.trim(), model: $('ai-model').value.trim(), key: $('ai-key').value, clearKey: $('ai-clear-key').checked }); $('ai-key').value = ''; $('ai-settings-state').textContent = ' Conexión guardada' + (c.hasKey ? ' · clave cifrada' : ''); toast('Configuración de IA guardada.'); });

editor.onDidChangeCursorPosition(event => { $('cursor-position').textContent = `Lín ${event.position.lineNumber}, Col ${event.position.column}`; });
window.addEventListener('keydown', event => {
  const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (document.querySelector('dialog[open]')) return;
  let action;
  if (ctrl && key === 'b') action = () => layout.toggle('sidebar');
  else if (ctrl && key === 'j') action = () => layout.toggle('terminal');
  else if (ctrl && event.shiftKey && key === 'm') action = () => layout.focusEditor();
  else if (ctrl && key === 's') action = () => saveFile(event.shiftKey);
  else if (ctrl && key === 'o') action = event.shiftKey ? openProject : openFiles;
  else if (ctrl && key === 'n') action = () => newDocument();
  else if (ctrl && key === 'k') action = showCommands;
  else if (ctrl && key === ',') action = () => showSettings();
  else if (key === 'f5') action = () => event.shiftKey ? api.stop() : run();
  else if (key === 'f7') action = () => diagrams.show();
  else if (key === 'f6') action = () => run(true);
  else if (key === 'f10') action = () => api.debug('paso');
  if (action) { event.preventDefault(); event.stopPropagation(); safe(action)(); }
}, true);
if (api) {
  api.on('engine:output', consumeOutput); api.on('engine:exit', finishRun); api.on('engine:debug', consumeDebug);
  api.on('window:closing', safe(async () => { persistDrafts(); if ((documents.some(isDirty) || running) && !(await api.confirm('Hay archivos sin guardar o una ejecución activa. Los borradores se recuperarán al abrir. ¿Cerrar PseudoStudio?'))) return; await api.readyToClose(); }));
}
$('example-list').innerHTML = examples.map((e, i) => `<button class="example-card" data-example="${i}">${icon(e.icon)}<span><b>${e.title}</b><small>${e.description}</small></span></button>`).join('');
const drafts = readStore('drafts', { files: [] });
for (const file of (drafts.files || []).slice(0, 30)) { try { newDocument(file, false); } catch { /* recover valid drafts only */ } }
if (!documents.length) newDocument({ name: examples[0].name, content: examples[0].code, pristine: true });
const active = documents.find(d => d.id === drafts.active) || documents[0]; if (active) activate(active);
applySettings(); applySections(); refreshIcons();
if (api) safe(async () => { const initial = await api.init(); if (!project) { project = initial.project; restoreProjectTree(); } await renderProject(); fonts = initial.fonts; for (const font of fonts) await loadFont(font).catch(() => {}); updateExtensions(initial.extensions); await document.fonts.ready; monaco.editor.remeasureFonts(); scheduleCheck(); })();
else toast('Vista de interfaz. Abre PseudoStudio.exe para ejecutar algoritmos.');
