const { test } = require('node:test');
const assert = require('node:assert/strict');

// Import pure operations
const {
  moveLinesArray,
  copyLinesArray,
  deleteLinesArray
} = require('../src/shortcuts.js');

test('atajos de línea estilo VS Code: mover línea hacia arriba y abajo', () => {
  const initial = ['linea1', 'linea2', 'linea3'];

  // Mover línea 2 hacia arriba (Alt + Up)
  const up = moveLinesArray(initial, 2, 2, -1);
  assert.deepEqual(up.lines, ['linea2', 'linea1', 'linea3']);
  assert.equal(up.startLine, 1);
  assert.equal(up.endLine, 1);

  // Intentar mover la primera línea hacia arriba (no debe cambiar)
  const topUp = moveLinesArray(up.lines, 1, 1, -1);
  assert.deepEqual(topUp.lines, ['linea2', 'linea1', 'linea3']);
  assert.equal(topUp.startLine, 1);

  // Mover línea 1 hacia abajo (Alt + Down)
  const down = moveLinesArray(up.lines, 1, 1, 1);
  assert.deepEqual(down.lines, ['linea1', 'linea2', 'linea3']);
  assert.equal(down.startLine, 2);

  // Intentar mover la última línea hacia abajo (no debe cambiar)
  const bottomDown = moveLinesArray(down.lines, 3, 3, 1);
  assert.deepEqual(bottomDown.lines, ['linea1', 'linea2', 'linea3']);
  assert.equal(bottomDown.endLine, 3);
});

test('atajos de línea estilo VS Code: mover bloque multilínea', () => {
  const code = ['Algoritmo Test', '    Definir a Como Entero', '    a <- 5', '    Escribir a', 'FinAlgoritmo'];

  // Mover bloque de líneas 2 a 3 hacia abajo (Alt + Down)
  const moved = moveLinesArray(code, 2, 3, 1);
  assert.deepEqual(moved.lines, [
    'Algoritmo Test',
    '    Escribir a',
    '    Definir a Como Entero',
    '    a <- 5',
    'FinAlgoritmo'
  ]);
  assert.equal(moved.startLine, 3);
  assert.equal(moved.endLine, 4);

  // Mover de regreso hacia arriba (Alt + Up)
  const restored = moveLinesArray(moved.lines, 3, 4, -1);
  assert.deepEqual(restored.lines, code);
  assert.equal(restored.startLine, 2);
  assert.equal(restored.endLine, 3);
});

test('atajos de línea estilo VS Code: duplicar línea arriba y abajo (Shift + Alt + Up/Down)', () => {
  const initial = ['a <- 1', 'b <- 2'];

  // Duplicar línea 2 hacia abajo (Shift + Alt + Down)
  const dupDown = copyLinesArray(initial, 2, 2, 1);
  assert.deepEqual(dupDown.lines, ['a <- 1', 'b <- 2', 'b <- 2']);

  // Duplicar línea 1 hacia arriba (Shift + Alt + Up)
  const dupUp = copyLinesArray(initial, 1, 1, -1);
  assert.deepEqual(dupUp.lines, ['a <- 1', 'a <- 1', 'b <- 2']);
});

test('atajos de línea estilo VS Code: eliminar línea (Ctrl + Shift + K)', () => {
  const initial = ['primera', 'segunda', 'tercera'];

  // Eliminar línea 2
  const deleted = deleteLinesArray(initial, 2, 2);
  assert.deepEqual(deleted.lines, ['primera', 'tercera']);
  assert.equal(deleted.newCursorLine, 2);

  // Eliminar última línea
  const deletedLast = deleteLinesArray(deleted.lines, 2, 2);
  assert.deepEqual(deletedLast.lines, ['primera']);
  assert.equal(deletedLast.newCursorLine, 1);
});
