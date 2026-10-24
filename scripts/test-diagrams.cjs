const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'ps-flow-'));
  const env={...process.env,PSEUDOSTUDIO_DATA_DIR:path.join(temp,'data')};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({...(process.env.PSEUDOSTUDIO_TEST_EXE?{executablePath:process.env.PSEUDOSTUDIO_TEST_EXE,args:[]}:{args:[root]}),env}),page=await app.firstWindow(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  const output=async(file)=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  try {
    await page.waitForSelector('.monaco-editor');await expect(page.locator('#extension-list .extension-card')).toHaveCount(2);
    await page.locator('#flow-open').click();await expect(page.locator('#diagram-canvas .decision')).toHaveCount(1);
    await expect(page.locator('#flow-svg')).toBeEnabled();
    await page.locator('#flow-plus').click();assert.notEqual(await page.locator('#flow-zoom').textContent(),'0%');
    await page.locator('#flow-fit').click();
    const svg=path.join(temp,'diagrama.svg');await output(svg);await page.locator('#flow-svg').click();await expect.poll(()=>fs.readFile(svg,'utf8')).toContain('<svg');
    const png=path.join(temp,'diagrama.png');await output(png);await page.locator('#flow-png').click();await expect.poll(async()=>{try{return (await fs.stat(png)).size;}catch{return 0;}}).toBeGreaterThan(1000);
    assert.equal((await fs.readFile(png)).subarray(1,4).toString(),'PNG');
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/flow-classic.png')});
    await page.locator('#flow-style').selectOption('nassi');await expect(page.locator('#diagram-canvas .nsif')).toHaveCount(1);
    await page.screenshot({path:path.join(root,'test-results/flow-nassi.png')});
    const block=page.locator('#diagram-canvas [data-source-line]').filter({hasText:'promedio<-'}).first();
    const line=await block.getAttribute('data-source-line');await block.click();await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#cursor-position')).toContainText('Lín '+line+',');
    await page.locator('#export-code').click();await expect(page.locator('#export-save')).toBeEnabled();await expect(page.locator('#export-preview')).toHaveValue(/print\(/);
    const py=path.join(temp,'promedio.py');await output(py);await page.locator('#export-save').click();await expect.poll(()=>fs.readFile(py,'utf8')).toContain('print(');
    await page.locator('#export-language').selectOption('cpp');await expect(page.locator('#export-preview')).toHaveValue(/#include/);await page.locator('[data-close="export-dialog"]').last().click();
    await page.locator('#flow-open').click();await page.locator('#flow-style').selectOption('classic');await expect(page.locator('#flow-svg')).toBeEnabled();
    await page.locator('#debug-run').click();await expect(page.locator('#run-state')).toContainText('En pausa');await expect(page.locator('#diagram-canvas .executing').first()).toBeVisible();
    await page.locator('#debug-continue').click();await expect(page.locator('#run-state')).toContainText('Finalizado');
    await page.locator('#flow-code').click();await page.locator('.monaco-editor textarea').first().focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('Algoritmo Incompleto\nSi Verdadero Entonces\nFinAlgoritmo');
    await page.locator('#flow-open').click();await expect(page.locator('#flow-status')).toContainText('Corrige los errores');await expect(page.locator('#flow-svg')).toBeDisabled();await expect(page.locator('#diagram-canvas svg')).toHaveCount(0);
    console.log('PASS classic/Nassi, SVG/PNG, navigation to source, Python/C++ preview/save, visual debugging, invalid code clears stale diagram');
    if(process.argv[2]){
      await page.locator('#flow-code').click();await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},process.argv[2]);await page.locator('#open-file').click();await expect(page.locator('#breadcrumb-file')).toHaveText(path.basename(process.argv[2]));
      await page.locator('#flow-open').click();await expect(page.locator('#flow-process option')).toHaveCount(3);await expect(page.locator('#flow-svg')).toBeEnabled();
      await page.locator('#flow-process').selectOption('0');await expect(page.locator('#flow-status')).toContainText('Estudiantes');await page.locator('#flow-style').selectOption('nassi');await expect(page.locator('#diagram-canvas svg')).toHaveCount(1);
      console.log('PASS external exercise: main algorithm and two subprograms rendered');
    }
    assert.deepEqual(errors,[]);
  }catch(e){console.log('Flow status:',await page.locator('#flow-status').textContent());await page.screenshot({path:path.join(root,'test-results/flow-failure.png')});throw e;}
  finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1});
