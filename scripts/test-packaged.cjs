const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{
  const root=path.resolve(__dirname,'..'),exe=process.env.PSEUDOSTUDIO_TEST_EXE || path.join(root,'release/win-unpacked/PseudoStudio.exe');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ps-packaged-'));
  const env={...process.env,PSEUDOSTUDIO_DATA_DIR:temp};delete env.ELECTRON_RUN_AS_NODE;
  const times=[];
  try{
    for(let attempt=0;attempt<3;attempt++){
      const start=Date.now();const app=await electron.launch({executablePath:exe,args:[],env});
      try{
        const page=await app.firstWindow();await page.waitForSelector('.monaco-editor');await expect(page.locator('#extension-list .extension-card')).toHaveCount(2);
        times.push(Date.now()-start);
        const resources=await app.evaluate(()=>process.resourcesPath);
        assert.equal(path.resolve(resources).toLowerCase(),path.join(path.dirname(exe),'resources').toLowerCase());
        await fs.access(path.join(resources,'engine/pseint.exe'));
        if(attempt===0){
          const second=spawn(exe,[],{env,windowsHide:true,stdio:'ignore'});
          await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{second.kill();reject(new Error('La segunda instancia no terminó.'));},10000);second.once('error',reject);second.once('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(new Error('Exit '+code));});});
          await fs.access(path.join(resources,'engine/pseint.exe'));
        }
        await page.locator('#run').click();await expect(page.locator('#console-output')).toContainText('Has aprobado.');await expect(page.locator('#run-state')).toContainText('Finalizado');
        if(attempt===0){await page.locator('#debug-run').click();await expect(page.locator('#run-state')).toContainText('En pausa');await page.locator('#debug-continue').click();await expect(page.locator('#run-state')).toContainText('Finalizado');}
      }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
    }
    console.log('PASS packaged: 3 starts, permanent resources, second-instance lock, execution and debugging. Startup ms: '+times.join(', '));
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});await fs.writeFile(path.join(root,'test-results/startup.json'),JSON.stringify({exe,milliseconds:times},null,2));
  }finally{await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1});
