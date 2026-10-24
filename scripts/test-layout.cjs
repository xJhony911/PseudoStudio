const {_electron:electron,expect} = require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'ps-layout-'));
  const env={...process.env,PSEUDOSTUDIO_DATA_DIR:temp};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({...(process.env.PSEUDOSTUDIO_TEST_EXE?{executablePath:process.env.PSEUDOSTUDIO_TEST_EXE,args:[]}:{args:[root]}),env});
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  const drag=async(id,dx,dy)=>{await page.bringToFront();await page.locator('#'+id).hover();const r=await page.locator('#'+id).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:8});await page.mouse.up();};
  try{
    await page.waitForSelector('.monaco-editor');await expect(page.locator('#extension-list .extension-card')).toHaveCount(2);
    const before=await page.locator('#sidebar').boundingBox();await drag('sidebar-resizer',90,0);
    await expect.poll(async()=>(await page.locator('#sidebar').boundingBox()).width).toBeGreaterThan(before.width+60);
    await drag('panel-resizer',0,-100);
    assert.ok((await page.locator('#bottom-panel').boundingBox()).height>300);
    await page.keyboard.press('Control+b');await expect(page.locator('#sidebar')).toBeHidden();await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+j');await expect(page.locator('#bottom-panel')).toBeHidden();await page.keyboard.press('Control+j');
    await page.locator('#ai-toggle').click();const ai=await page.locator('#ai-panel').boundingBox();await drag('ai-resizer',-60,0);
    assert.ok((await page.locator('#ai-panel').boundingBox()).width>ai.width+35);
    await page.locator('#ai-close').click();
    await page.locator('#layout-open').click();await page.locator('#layout-side').selectOption('right');await page.locator('#layout-dock').selectOption('right');await page.locator('[data-close="layout-dialog"]').last().click();
    const sidebar=await page.locator('#sidebar').boundingBox(),editor=await page.locator('#editor').boundingBox(),terminal=await page.locator('#bottom-panel').boundingBox();
    assert.ok(sidebar.x>editor.x);assert.ok(terminal.x>editor.x);await drag('panel-resizer',-50,0);
    await page.locator('#panel-maximize').click();await expect(page.locator('#editor-main')).toBeHidden();
    await page.locator('#panel-maximize').click();await expect(page.locator('#editor-main')).toBeVisible();
    await page.reload();await expect(page.locator('#extension-list .extension-card')).toHaveCount(2);
    await expect(page.locator('#editor-column')).toHaveClass(/terminal-right/);
    assert.ok((await page.locator('#sidebar').boundingBox()).width>300);
    await page.keyboard.press('Control+Shift+m');await expect(page.locator('#sidebar')).toBeHidden();await expect(page.locator('#bottom-panel')).toBeHidden();
    await page.keyboard.press('Control+Shift+m');await expect(page.locator('#sidebar')).toBeVisible();await expect(page.locator('#bottom-panel')).toBeVisible();
    await page.locator('#panel-hide').click();await page.locator('#run').click();await expect(page.locator('#console-output')).toContainText('Has aprobado.');await expect(page.locator('#bottom-panel')).toBeVisible();
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/layout-right.png')});
    await page.locator('#layout-open').click();await page.locator('#layout-reset').click();await page.locator('[data-close="layout-dialog"]').last().click();
    await expect(page.locator('#editor-column')).not.toHaveClass(/terminal-right/);assert.deepEqual(errors,[]);
    console.log('PASS resize sidebar/terminal/AI, hide/show, dock right, maximize, persistence, restore, run reveals terminal');
  }catch(error){ await page.screenshot({path:path.join(root,'test-results/layout-failure.png')}); throw error; }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1});
