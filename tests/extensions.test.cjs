const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateExtension } = require('../electron/extensions.cjs');
test('acepta una extensión instalable de temas y snippets', () => { const data = require('../examples/extensions/ocean.json'); assert.equal(validateExtension(data).themes.length, 1); });
test('rechaza IDs con rutas y colores CSS ejecutables', () => {
  assert.throws(() => validateExtension({ id: '../escape', name: 'Bad', version: '1' }));
  assert.throws(() => validateExtension({ id: 'bad.colors', name: 'Bad', version: '1', themes: [{ id: 'bad', name: 'Bad', base: 'vs-dark', colors: { 'editor.background': 'url(https://example.com)' } }] }));
});
test('solo conserva capacidades declarativas', () => { const data = validateExtension({ id: 'safe.extension', name: 'Safe', version: '1', script: 'process.exit()' }); assert.equal(data.script, undefined); });
