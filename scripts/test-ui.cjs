const { _electron: electron, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudostudio-ui-'));
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  const received = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', b => body += b);
    req.on('end', () => { received.push({ url: req.url, body: JSON.parse(body) }); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: 'Respuesta de prueba: tu algoritmo usa variables y una condición.' } }] })); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, PSEUDOSTUDIO_DATA_DIR: path.join(temp, 'userdata') }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ ...(process.env.PSEUDOSTUDIO_TEST_EXE ? {executablePath:process.env.PSEUDOSTUDIO_TEST_EXE,args:[]} : {args:[root]}), env, timeout: 30000 });
  const failures = [];
  const page = await app.firstWindow();
  page.on('pageerror', err => { failures.push(err.message); console.error('Renderer error:', err.stack); });
  const check = async (label, fn) => { await fn(); console.log('PASS ' + label); };
  try {
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await expect(page.locator('#extension-list .extension-card')).toHaveCount(2);
    await check('inicio, ejemplo y ejecución con motor real', async () => {
      await page.locator('#run').click(); await expect(page.locator('#console-output')).toContainText('Has aprobado.', { timeout: 15000 });
      await expect(page.locator('#run-state')).toContainText('Finalizado');
    });
    await page.screenshot({ path: path.join(root, 'test-results/editor-obsidiana.png') });
    await check('temas, fuente y persistencia de ajustes', async () => {
      await page.locator('#settings-open').click(); await page.locator('[data-theme="monokai"]').click();
      await expect(page.locator('#theme-status')).toHaveText('Monokai');
      await page.locator('#font-size').fill('18'); await page.locator('#font-size').dispatchEvent('input');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).fontSize), 18);
      await page.screenshot({ path: path.join(root, 'test-results/ajustes-monokai.png') });
      await page.locator('[data-close="settings-dialog"]').first().click();
    });
    await check('entrada de teclado y texto español', async () => {
      await page.locator('[data-view="examples"]').click(); await page.locator('[data-example="1"]').click();
      await page.locator('#run').click(); await expect(page.locator('#input-form')).toBeVisible({ timeout: 15000 });
      await page.locator('#console-input').fill('José'); await page.locator('#console-input').press('Enter');
      await expect(page.locator('#console-output')).toContainText('¡Hola, José!', { timeout: 10000 });
    });
    await check('diagnósticos y marcadores de sintaxis', async () => {
      await page.locator('#new-file').click(); await page.locator('.monaco-editor textarea').first().focus();
      await page.keyboard.press('Control+a'); await page.keyboard.insertText('Algoritmo ErrorSintaxis\nSi Verdadero Entonces\nEscribir "Hola"\nFinAlgoritmo');
      await expect(page.locator('#problem-count')).not.toHaveText('0', { timeout: 15000 });
      await page.locator('[data-panel="problems"]').click(); await expect(page.locator('#problems-list .problem').first()).toBeVisible();
    });
    await check('guardar y abrir archivos .psc reales', async () => {
      const save = path.join(temp, 'guardado.psc');
      await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, save);
      await page.locator('#save-file').click();
      await expect(page.locator('#breadcrumb-file')).toHaveText('guardado.psc');
      assert.match((await fs.readFile(save)).toString('latin1'), /ErrorSintaxis/);
      const open = path.join(temp, 'abierto.psc'); await fs.writeFile(open, Buffer.from('Algoritmo Abierto\nEscribir "áéíóú ñ"\nFinAlgoritmo', 'latin1'));
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, open);
      await page.locator('#open-file').click(); await expect(page.locator('#breadcrumb-file')).toHaveText('abierto.psc');
      await page.locator('#run').click(); await expect(page.locator('#console-output')).toContainText('áéíóú ñ', { timeout: 15000 });
    });
    await check('autocompletado de snippets y palabras clave', async () => {
      await page.locator('#new-file').click(); await page.locator('.monaco-editor textarea').first().focus();
      await page.keyboard.press('Control+a'); await page.keyboard.insertText('Algoritmo DemoAuto\n    par');
      await page.keyboard.press('Control+Space');
      await expect(page.locator('.suggest-widget.visible')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.suggest-widget.visible')).toContainText('para');
      await page.keyboard.press('Escape');
    });
    await check('importación de fuente sin instalarla en Windows', async () => {
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, path.join(root, 'public/fonts/ComicMono.ttf'));
      await page.locator('#settings-open').click(); await page.locator('#import-font').click();
      await expect(page.locator('#font-family')).toHaveValue('ComicMonottf');
      await page.locator('#font-family').selectOption('Comic Mono');
      await page.locator('[data-close="settings-dialog"]').first().click();
    });
    await check('instalar y desactivar extensión declarativa', async () => {
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, path.join(root, 'examples/extensions/ocean.json'));
      await page.locator('[data-view="extensions"]').click(); await page.locator('#install-extension').click();
      await expect(page.locator('#extension-list .extension-card')).toHaveCount(3);
      await page.locator('#settings-open').click(); await expect(page.locator('[data-theme^="ext-"]')).toBeVisible();
      await page.locator('[data-theme^="ext-"]').click(); await expect(page.locator('#theme-status')).toHaveText('Océano');
      await page.locator('[data-close="settings-dialog"]').first().click();
      await page.locator('[data-extension="community.ocean"]').click(); await expect(page.locator('#theme-status')).toHaveText('Obsidiana');
    });
    await check('depuración paso a paso y valores observados', async () => {
      await page.locator('[data-view="examples"]').click(); await page.locator('[data-example="0"]').click();
      await page.locator('#debug-run').click(); await expect(page.locator('#run-state')).toContainText('En pausa', { timeout: 15000 });
      for (let i = 0; i < 6; i++) { await page.locator('#debug-step').click(); await page.waitForTimeout(130); }
      await expect(page.locator('#variables-list')).toContainText('8.5');
      await page.screenshot({ path: path.join(root, 'test-results/depuracion.png') });
      await page.locator('#debug-continue').click(); await expect(page.locator('#run-state')).toContainText('Finalizado', { timeout: 15000 });
    });
    await check('IA opcional con proveedor simulado local', async () => {
      await page.locator('#ai-toggle').click(); await page.locator('#ai-configure').click();
      await page.locator('#ai-url').fill(`http://127.0.0.1:${server.address().port}/v1`); await page.locator('#ai-model').fill('modelo-de-prueba'); await page.locator('#save-ai').click();
      await expect(page.locator('#ai-settings-state')).toContainText('guardada'); await page.locator('[data-close="settings-dialog"]').first().click();
      await page.locator('#ai-question').fill('Explica el algoritmo'); await page.locator('#ai-send').click();
      await expect(page.locator('#ai-conversation')).toContainText('Respuesta de prueba', { timeout: 10000 });
      assert.equal(received[0].url, '/v1/chat/completions'); assert.equal(received[0].body.model, 'modelo-de-prueba');
      assert.match(received[0].body.messages[1].content, /CalcularPromedio/);
      await page.locator('#ai-close').click();
    });
    await check('paleta de comandos y cambio de vista', async () => {
      await page.locator('#command-open').click(); await page.locator('#command-input').fill('ejemplos'); await page.locator('#command-input').press('Enter');
      await expect(page.locator('#examples-view')).toBeVisible();
    });
    await check('recuperación de borradores después de recargar', async () => {
      const before = await page.locator('#tabs .tab').count(); await page.reload(); await page.waitForSelector('.monaco-editor'); await expect(page.locator('#tabs .tab')).toHaveCount(before);
    });
    assert.deepEqual(failures, [], 'Errores JavaScript en la interfaz');
    console.log('PASS sin errores JavaScript');
  } catch (err) {
    console.error('TOAST:', await page.locator('#toast').textContent().catch(() => ''));
    console.error('PAGE ERRORS:', failures);
    await page.screenshot({ path: path.join(root, 'test-results/failure.png') }).catch(() => {});
    throw err;
  } finally {
    await app.evaluate(() => require('electron').app.exit(0)).catch(() => {}); await app.close().catch(() => {}); server.close();
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
