const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ps-regressions-'));
  const folder = path.join(temp, 'Proyecto'); await fs.mkdir(path.join(folder, 'sub'), {recursive:true});
  await fs.writeFile(path.join(folder,'uno.psc'), 'Algoritmo Uno\nEscribir "uno"\nFinAlgoritmo');
  await fs.writeFile(path.join(folder,'tardio.psc'), 'Algoritmo Tardio\nEscribir "tardio"\nFinAlgoritmo');
  await fs.writeFile(path.join(folder,'sub/dos.psc'), 'Algoritmo Dos\nEscribir "dos"\nFinAlgoritmo');
  const env = {...process.env, PSEUDOSTUDIO_DATA_DIR:path.join(temp,'data')}; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({...(process.env.PSEUDOSTUDIO_TEST_EXE ? {executablePath:process.env.PSEUDOSTUDIO_TEST_EXE,args:[]} : {args:[root]}),env});
  const page = await app.firstWindow(), errors = []; page.on('pageerror', e => errors.push(e.stack));
  try {
    await page.waitForSelector('.monaco-editor');
    await app.evaluate(({dialog}, folder) => {dialog.showOpenDialog = async () => ({canceled:false,filePaths:[folder]});}, folder);
    await page.locator('#open-project').click();
    await page.locator('[data-project-path="uno.psc"]').click();
    await expect(page.locator('#breadcrumb-file')).toHaveText('uno.psc');
    await page.locator('.monaco-editor textarea').first().focus(); await page.keyboard.press('Control+a');
    await page.keyboard.insertText('Algoritmo Uno\nEscribir "SIN GUARDAR"\nFinAlgoritmo');
    await page.locator('[data-project-path="sub"]').click();
    await page.locator('[data-project-path$="dos.psc"]').click();
    const count = await page.locator('#tabs .tab').count();
    for (let i=0; i<5; i++) {
      await page.locator('[data-project-path="uno.psc"]').click();
      await page.locator('#tabs .tab').filter({hasText:'dos.psc'}).click();
    }
    await page.locator('[data-project-path="uno.psc"]').click();
    await expect(page.locator('#tabs .tab')).toHaveCount(count);
    await page.locator('#run').click(); await expect(page.locator('#console-output')).toContainText('SIN GUARDAR');
    await expect(page.locator('#run-state')).toContainText('Finalizado');
    await expect(page.locator('[data-project-path="sub"]')).toHaveAttribute('aria-expanded','true');
    console.log('PASS repeated tab/tree navigation preserves unsaved content and expanded folders');

    // Delay only the requested file, then choose an already-open tab while the read is pending.
    await app.evaluate(({ipcMain}) => {
      const original = ipcMain._invokeHandlers.get('workspace:read');
      ipcMain.removeHandler('workspace:read');
      ipcMain.handle('workspace:read', async (event, relative, ...args) => {
        if (relative === 'tardio.psc') { ipcMain.__readPending = true; await new Promise(r=>setTimeout(r,500)); }
        return original(event, relative, ...args);
      });
    });
    await page.locator('[data-project-path="tardio.psc"]').click();
    await expect.poll(()=>app.evaluate(({ipcMain})=>!!ipcMain.__readPending)).toBe(true);
    await page.locator('#tabs .tab').filter({hasText:'dos.psc'}).click();
    await page.waitForTimeout(650);
    await expect(page.locator('#breadcrumb-file')).toHaveText('dos.psc');
    await expect(page.locator('#tabs .tab')).toHaveCount(count);

    await page.locator('[data-project-path="sub"]').click();
    await expect(page.locator('[data-project-path="sub"]')).toHaveAttribute('aria-expanded','false');
    await app.evaluate(({ipcMain}) => {
      const original = ipcMain._invokeHandlers.get('workspace:list');
      ipcMain.removeHandler('workspace:list');
      ipcMain.handle('workspace:list', async (event, relative, ...args) => {
        if (relative === 'sub') { ipcMain.__listPending = true; await new Promise(r=>setTimeout(r,500)); }
        return original(event, relative, ...args);
      });
    });
    await page.locator('[data-project-path="sub"]').click();
    await expect.poll(()=>app.evaluate(({ipcMain})=>!!ipcMain.__listPending)).toBe(true);
    await page.locator('[data-project-path="sub"]').click();
    await page.waitForTimeout(650);
    await expect(page.locator('[data-project-path="sub"]')).toHaveAttribute('aria-expanded','false');
    await expect(page.locator('[data-project-path$="dos.psc"]')).toHaveCount(0);
    console.log('PASS delayed reads and directory listings cannot replace newer selection');

    for(const section of ['project','files','outline']) await page.locator('#'+section+'-toggle').click();
    for(const id of ['project-tree','file-list','outline']) await expect(page.locator('#'+id)).toBeHidden();
    await page.locator('#tabs .tab').filter({hasText:'uno.psc'}).click();
    await page.reload(); await expect(page.locator('#project-name')).toHaveText('Proyecto');
    for(const id of ['project-tree','file-list','outline']) await expect(page.locator('#'+id)).toBeHidden();
    for(const section of ['project','files','outline']) await page.locator('#'+section+'-toggle').click();
    await page.locator('#save-file').click();
    await expect.poll(()=>fs.readFile(path.join(folder,'uno.psc'),'utf8')).toContain('SIN GUARDAR');
    await page.locator('#outline-toggle').click();
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/explorer-fixed.png')});
    assert.deepEqual(errors, []);
    console.log('PASS collapsible sections persist, restored project saves directly, no renderer errors');
  } finally {
    await app.evaluate(({app})=>app.exit(0)).catch(()=>{}); await app.close().catch(()=>{});
    await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

