const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Workspace } = require('../electron/workspace.cjs');
test('proyecto: subcarpetas, texto, acentos, duplicados y rutas fuera de raíz', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ps-workspace-'));
  try {
    const w = new Workspace(); await w.open(root);
    await w.create('', 'Práctica', true);
    const file = await w.create('Práctica', 'hola.psc');
    assert.match((await w.read(file.relative)).content, /Algoritmo/);
    assert.equal((await w.list('Práctica'))[0].name, 'hola.psc');
    await assert.rejects(w.create('Práctica', 'hola.psc'), /EEXIST/);
    await assert.rejects(w.create('', '../fuera.psc'), /no válido/);
    await assert.rejects(w.list('..'), /sale del proyecto/);
    await assert.rejects(w.create('', 'CON.psc'), /no válido/);
    await fs.writeFile(path.join(root, 'español.txt'), Buffer.from('¡Hola, José!', 'latin1'));
    assert.equal((await w.read('español.txt')).content, '¡Hola, José!');
    await fs.writeFile(path.join(root, 'imagen.bin'), Buffer.from([1, 0, 2]));
    await assert.rejects(w.read('imagen.bin'), /binario/);
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ps-outside-'));
    try {
      await fs.symlink(outside, path.join(root, 'enlace'), 'junction');
      assert.ok(!(await w.list()).some(e => e.name === 'enlace'));
      await assert.rejects(w.create('enlace', 'escape.psc'), /sale del proyecto/);
    } finally { await fs.rm(outside, { recursive: true, force: true }); }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
