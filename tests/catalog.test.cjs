const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const {
  validateExtension,
  readCatalogExtensions,
  readInstalledExtensions,
  installCatalogExtension,
  uninstallExtension
} = require('../electron/extensions.cjs');

test('el catálogo incluye la extensión oficial de Discord Rich Presence', async () => {
  const catalogDir = path.join(__dirname, '../catalog/extensions');
  const catalog = await readCatalogExtensions([catalogDir]);
  const discordExt = catalog.find(e => e.id === 'pseudostudio.discord-presence');

  assert.ok(discordExt, 'Discord Presence debe estar en el catálogo');
  assert.equal(discordExt.name, 'Discord Rich Presence');
  assert.equal(discordExt.category, 'Integración');
  assert.deepEqual(discordExt.features, ['discord-rpc']);
});

test('el catálogo contiene extensiones declarativas disponibles pero no preinstaladas', async () => {
  const catalogDir = path.join(__dirname, '../catalog/extensions');
  const catalog = await readCatalogExtensions([catalogDir]);

  assert.ok(catalog.length >= 4, 'El catálogo debe contener múltiples extensiones');
  const ids = catalog.map(e => e.id);
  assert.ok(ids.includes('pseudostudio.discord-presence'));
  assert.ok(ids.includes('pseudostudio.basics'));
  assert.ok(ids.includes('pseudostudio.ocean'));
});

test('instalación y desinstalación de extensiones desde el catálogo a carpeta de usuario', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudo-test-ext-'));
  const catalogDir = path.join(__dirname, '../catalog/extensions');

  try {
    // Inicialmente no hay extensiones instaladas
    let installed = await readInstalledExtensions(tmpDir);
    assert.equal(installed.length, 0, 'No debe haber extensiones preinstaladas');

    // Instalar Discord Presence desde el catálogo
    const installedExt = await installCatalogExtension([catalogDir], tmpDir, 'pseudostudio.discord-presence');
    assert.equal(installedExt.id, 'pseudostudio.discord-presence');

    installed = await readInstalledExtensions(tmpDir);
    assert.equal(installed.length, 1);
    assert.equal(installed[0].id, 'pseudostudio.discord-presence');
    assert.equal(installed[0].enabled, true);

    // Desinstalar
    const removed = await uninstallExtension(tmpDir, 'pseudostudio.discord-presence');
    assert.equal(removed, true);

    installed = await readInstalledExtensions(tmpDir);
    assert.equal(installed.length, 0);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});
