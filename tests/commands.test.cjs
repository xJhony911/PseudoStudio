const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read src/commands.js source to extract data without full ESM bundler in test
const commandsSource = fs.readFileSync(path.join(__dirname, '../src/commands.js'), 'utf-8');

test('módulos de comandos de PSeInt: 9 comandos completos con plantillas y variantes', () => {
  const expectedIds = ['escribir', 'leer', 'asignar', 'si', 'segun', 'mientras', 'repetir', 'para', 'funcion'];
  
  for (const id of expectedIds) {
    assert.ok(commandsSource.includes(`id: '${id}'`), `Debe existir el comando con id: ${id}`);
  }

  // Verify all icon PNG files exist in public/commands
  const publicDir = path.join(__dirname, '../public/commands');
  for (const id of expectedIds) {
    const iconName = `${id}.png`;
    assert.ok(fs.existsSync(path.join(publicDir, iconName)), `El icono ${iconName} debe existir en public/commands`);
  }
});

test('los comandos incluyen soporte para arrastrar y soltar (drag & drop) y modo alternativo Shift', () => {
  assert.ok(commandsSource.includes('dragstart'), 'Debe incluir evento dragstart');
  assert.ok(commandsSource.includes('dragover'), 'Debe incluir evento dragover');
  assert.ok(commandsSource.includes('drop'), 'Debe incluir evento drop');
  assert.ok(commandsSource.includes('application/x-pseudostudio-command'), 'Debe incluir tipo MIME de arrastre personalizado');
  assert.ok(commandsSource.includes('altTemplate'), 'Debe incluir plantillas alternativas para Shift');
  assert.ok(commandsSource.includes('Sin Saltar'), 'Debe incluir variante Sin Saltar');
  assert.ok(commandsSource.includes('Para Cada'), 'Debe incluir variante Para Cada');
});

test('las imágenes de los comandos usan data URIs base64 para carga 100% fiable en Electron', () => {
  const commandIconsSource = fs.readFileSync(path.join(__dirname, '../src/command-icons.js'), 'utf-8');
  const expectedIds = ['escribir', 'leer', 'asignar', 'si', 'segun', 'mientras', 'repetir', 'para', 'funcion'];
  
  for (const id of expectedIds) {
    assert.ok(commandIconsSource.includes(`"${id}": "data:image/png;base64,`), `COMMAND_ICONS debe contener ${id} en base64`);
  }
  assert.ok(commandsSource.includes('COMMAND_ICONS'), 'src/commands.js debe importar y utilizar COMMAND_ICONS');
});

test('soporte para programar desde el diagrama: barra de inserción rápida, drag & drop e indicador de pestaña', () => {
  const diagramsSource = fs.readFileSync(path.join(__dirname, '../src/diagrams.js'), 'utf-8');
  const flowchartSource = fs.readFileSync(path.join(__dirname, '../src/flowchart.js'), 'utf-8');
  const mainSource = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf-8');

  // Programming from diagram in diagrams.js
  assert.ok(diagramsSource.includes('insertCommand'), 'src/diagrams.js debe tener la función insertCommand');
  assert.ok(diagramsSource.includes('renderCommandBar'), 'src/diagrams.js debe renderizar la barra de inserción rápida');
  assert.ok(diagramsSource.includes('setupDiagramDrop'), 'src/diagrams.js debe soportar soltar comandos en el diagrama');
  assert.ok(diagramsSource.includes('isVisible:'), 'src/diagrams.js debe exponer isVisible');

  // Flowchart hover and drop-target styling
  assert.ok(flowchartSource.includes('.flow-node:hover'), 'src/flowchart.js debe incluir estilos :hover para nodos');
  assert.ok(flowchartSource.includes('.flow-node.drop-target'), 'src/flowchart.js debe incluir estilo drop-target');
  assert.ok(flowchartSource.includes('Clic para ir al código'), 'src/flowchart.js debe incluir tooltip explicativo');

  // Tab distinguishability in main.js
  assert.ok(mainSource.includes('diagram-tab'), 'src/main.js debe renderizar la pestaña de diagrama');
  assert.ok(mainSource.includes('inactive-while-diagram'), 'src/main.js debe marcar la pestaña de código como inactiva en modo diagrama');
  assert.ok(mainSource.includes('close-diagram-tab'), 'src/main.js debe manejar el cierre de la pestaña de diagrama');
});
