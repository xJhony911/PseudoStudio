const { _electron: electron, expect } = require('@playwright/test');
const path=require('path'),fs=require('fs/promises'),os=require('os');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ps-project-'));
 const root=path.resolve(__dirname, '..');
 const env={...process.env,PSEUDOSTUDIO_DATA_DIR:path.join(temp,'data')};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({...(process.env.PSEUDOSTUDIO_TEST_EXE ? {executablePath:process.env.PSEUDOSTUDIO_TEST_EXE,args:[]} : {args:[root]}),env});const page=await app.firstWindow();
 try{
 await page.waitForSelector('.monaco-editor');
 await fs.mkdir(path.join(root, 'test-results'), {recursive:true});
 const file = process.argv[2];
 if(file) {
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);
 await page.locator('#open-file').click();await expect(page.locator('#breadcrumb-file')).toHaveText(path.basename(file));
 await page.locator('#run').click();
 for(const input of ['1','José','Luis','Pérez','López','1','Informática','8','10','10','100','3']){
 await expect(page.locator('#input-form')).toBeVisible({timeout:10000});
 await page.locator('#console-input').fill(input);await page.locator('#console-input').press('Enter');
 await page.waitForTimeout(100);
 }
 await expect(page.locator('#console-output')).toContainText('Cerrando sesion');
 await expect(page.locator('#run-state')).toContainText('Finalizado');
 console.log('PASS original YANKAY completed with interactive student input');
 await page.screenshot({path:path.join(root,'test-results/exercise.png')});
 }
 const folder=path.join(temp,'Proyecto á');await fs.mkdir(folder);await fs.writeFile(path.join(folder,'hola.psc'),'Algoritmo Hola\nEscribir "proyecto"\nFinAlgoritmo');
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},folder);
 await page.locator('#open-project').click();await expect(page.locator('#project-name')).toHaveText('Proyecto á');
 await page.locator('[data-project-path="hola.psc"]').click();await expect(page.locator('#breadcrumb-file')).toHaveText('hola.psc');
 await page.locator('#project-folder').click();await page.locator('#entry-name').fill('ejercicios');await page.locator('#entry-form [type="submit"]').click();
 await page.locator('[data-project-path="ejercicios"]').click();
 await page.locator('#project-file').click();await page.locator('#entry-name').fill('nuevo.psc');await page.locator('#entry-form [type="submit"]').click();
 await expect(page.locator('#breadcrumb-file')).toHaveText('nuevo.psc');
 await page.locator('.monaco-editor textarea').first().focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('Algoritmo Nuevo\nEscribir "guardado"\nFinAlgoritmo');
 await page.locator('#save-file').click();await expect.poll(()=>fs.readFile(path.join(folder,'ejercicios/nuevo.psc'),'utf8')).toContain('guardado');
 await page.reload();await expect(page.locator('#project-name')).toHaveText('Proyecto á');
 await expect(page.locator('[data-project-path="ejercicios"]')).toHaveAttribute('aria-expanded','true'); await page.locator('[data-project-path$="nuevo.psc"]').click();
 await page.locator('#run').click();await expect(page.locator('#console-output')).toContainText('guardado');
 await page.screenshot({path:path.join(root,'test-results/project.png')});
 console.log('PASS folder, nested create, save, restore, execute');
 }catch(e){console.log(await page.locator('#toast').textContent());console.log(await page.locator('#console-output').textContent());throw e}
 finally{await app.evaluate(({app})=>app.exit(0));await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1});
