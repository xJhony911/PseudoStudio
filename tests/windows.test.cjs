const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const windowsSource = fs.readFileSync(path.join(__dirname, '../src/windows.js'), 'utf-8');
const themesSource = fs.readFileSync(path.join(__dirname, '../src/themes.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf-8');
const htmlSource = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf-8');

test('gestor de ventanas flotantes (windows.js): MDI completo con popout, dock, minimizar y maximizar', () => {
  assert.ok(windowsSource.includes('export function createWindowManager'), 'Debe exportar createWindowManager');
  assert.ok(windowsSource.includes('popoutTerminal'), 'Debe tener popoutTerminal');
  assert.ok(windowsSource.includes('dockTerminal'), 'Debe tener dockTerminal');
  assert.ok(windowsSource.includes('popoutDiagram'), 'Debe tener popoutDiagram');
  assert.ok(windowsSource.includes('dockDiagram'), 'Debe tener dockDiagram');
  assert.ok(windowsSource.includes('toggleMaximize'), 'Debe tener toggleMaximize');
  assert.ok(windowsSource.includes('toggleMinimize'), 'Debe tener toggleMinimize');
  assert.ok(windowsSource.includes('bringToFront'), 'Debe tener bringToFront');
  assert.ok(windowsSource.includes('floatingWindowsState'), 'Debe guardar y restaurar el estado en localStorage');
});

test('gestor de ventanas: redimensión en 8 direcciones y arrastre con límites de pantalla', () => {
  const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  for (const dir of directions) {
    assert.ok(htmlSource.includes(`data-direction="${dir}"`), `index.html debe tener manilla para '${dir}'`);
  }
  assert.ok(windowsSource.includes("dir.includes('e')"), 'Debe manejar eje horizontal este');
  assert.ok(windowsSource.includes("dir.includes('w')"), 'Debe manejar eje horizontal oeste');
  assert.ok(windowsSource.includes("dir.includes('s')"), 'Debe manejar eje vertical sur');
  assert.ok(windowsSource.includes("dir.includes('n')"), 'Debe manejar eje vertical norte');
  assert.ok(windowsSource.includes('Math.max') && windowsSource.includes('Math.min'), 'Debe calcular clamping dentro del viewport');
  assert.ok(windowsSource.includes('pointerdown'), 'Debe soportar puntero pointerdown para arrastre fluido');
  assert.ok(windowsSource.includes('pointermove'), 'Debe soportar puntero pointermove');
  assert.ok(windowsSource.includes('pointerup'), 'Debe soportar puntero pointerup');
});

test('soporte para arrastrar para desacoplar a ventana independiente (tear-off drag-and-drop)', () => {
  assert.ok(windowsSource.includes('setupTearOff'), 'Debe configurar desacople por arrastre');
  assert.ok(windowsSource.includes('isDraggingPanel'), 'Debe detectar arrastre desde la cabecera del panel');
  assert.ok(windowsSource.includes('isDraggingDiag'), 'Debe detectar arrastre desde la barra del diagrama');
});

test('tema clásico fiel al PSeInt original (themes.js): UI gris clásica y resaltado exacto', () => {
  assert.ok(themesSource.includes("id: 'pseint-classic'"), 'Debe incluir tema pseint-classic');
  assert.ok(themesSource.includes("name: 'PSeInt Clásico'"), 'Debe tener el nombre descriptivo');
  assert.ok(themesSource.includes('#ece9d8'), 'Debe usar el gris clásico de PSeInt (#ece9d8)');
  assert.ok(themesSource.includes('#ffffff'), 'Debe usar fondo blanco en editor (#ffffff)');
  assert.ok(themesSource.includes('keyword: \'0000ff\''), 'Debe usar azul clásico para palabras clave (0000ff)');
  assert.ok(themesSource.includes('string: \'a00000\''), 'Debe usar rojo oscuro para cadenas (a00000)');
  assert.ok(themesSource.includes('number: \'008000\''), 'Debe usar verde para números (008000)');
});

test('DOM y marcado (index.html): selector de interfaz, ventanas flotantes y botones de desacople', () => {
  assert.ok(htmlSource.includes('id="ui-mode-select"'), 'Debe tener selector de interfaz en la barra principal');
  assert.ok(htmlSource.includes('value="modern"'), 'Opción Moderna Studio');
  assert.ok(htmlSource.includes('value="classic-pseint"'), 'Opción Clásica PSeInt');
  assert.ok(htmlSource.includes('value="classic-studio"'), 'Opción Clásica PseudoStudio');
  assert.ok(htmlSource.includes('id="float-win-terminal"'), 'Ventana flotante de terminal');
  assert.ok(htmlSource.includes('id="float-win-diagram"'), 'Ventana flotante de diagrama');
  assert.ok(htmlSource.includes('id="panel-popout"'), 'Botón para desacoplar terminal');
  assert.ok(htmlSource.includes('id="flow-popout"'), 'Botón para desacoplar flujograma');
  assert.ok(htmlSource.includes('id="floating-taskbar"'), 'Barra de tareas para ventanas minimizadas');
});

test('estilos CSS (style.css): skins moderna, clásica PSeInt original y clásica Studio', () => {
  assert.ok(cssSource.includes('.ui-mode-modern'), 'Debe contener reglas para ui-mode-modern');
  assert.ok(cssSource.includes('.ui-mode-classic-pseint'), 'Debe contener reglas para ui-mode-classic-pseint');
  assert.ok(cssSource.includes('.ui-mode-classic-studio'), 'Debe contener reglas para ui-mode-classic-studio');
  assert.ok(cssSource.includes('.floating-window'), 'Debe contener reglas para ventanas flotantes');
  assert.ok(cssSource.includes('.win-resize-handle'), 'Debe contener reglas para los controles de redimensión');
  assert.ok(cssSource.includes('.floating-taskbar'), 'Debe contener barra de minimizados');
});

test('integración en main.js: comandos de interfaz, atajos y ventanas automáticas en modo clásico', () => {
  assert.ok(mainSource.includes('Interfaz: Cambiar a Moderna Studio'), 'Debe tener comando de cambio a moderna');
  assert.ok(mainSource.includes('Interfaz: Cambiar a Clásica PSeInt Original'), 'Debe tener comando de cambio a clásica PSeInt');
  assert.ok(mainSource.includes('Ventana: Desacoplar / Acoplar Terminal'), 'Debe tener comando de desacople de terminal');
  assert.ok(mainSource.includes('Ventana: Desacoplar / Acoplar Diagrama'), 'Debe tener comando de desacople de diagrama');
  assert.ok(mainSource.includes("setUiMode('classic-pseint')"), 'Debe activar modo clásico PSeInt');
  assert.ok(mainSource.includes('windowManager.showFloating'), 'Debe invocar ventana flotante al ejecutar en modo ventana');
});
