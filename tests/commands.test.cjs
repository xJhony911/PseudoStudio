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
