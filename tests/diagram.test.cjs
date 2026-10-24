const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {Engine}=require('../electron/engine.cjs');
const engine=new Engine(path.resolve(__dirname,'../engine'));
const code=`SubProceso Saludo(nombre)
Escribir nombre
FinSubProceso
Algoritmo PruebaFlujo
Definir x,i Como Entero
Leer x
Si x>0 Entonces
Escribir "<script> & texto"
SiNo
Saludo("No")
FinSi
Para i<-1 Hasta 3 Hacer
x<-x+i
FinPara
Mientras x<10 Hacer
x<-x+1
FinMientras
Repetir
x<-x-1
Hasta Que x=0
Segun x Hacer
0: Escribir "cero"
1,2: Escribir "otro"
De Otro Modo: Escribir "resto"
FinSegun
FinAlgoritmo`;
test('diagrama nativo: procesos, posiciones, condiciones, bucles y casos',async()=>{
  const {parseDiagram,renderDiagram}=await import('../src/flowchart.js');
  const result=await engine.diagram(code);assert.deepEqual(result.errors,[]);
  const programs=parseDiagram(result.text);assert.equal(programs.length,2);assert.equal(programs[1].name,'PruebaFlujo');assert.equal(programs[1].line,4);
  const body=programs[1].body;assert.equal(body.filter(n=>n.kind==='loop').length,2);assert.equal(body.find(n=>n.kind==='if').no[0].kind,'call');assert.equal(body.find(n=>n.kind==='switch').branches.length,3);assert.equal(body.find(n=>n.kind==='repeat').until,true);
  for(const style of ['classic','nassi']){const diagram=renderDiagram(programs[1],style);assert.ok(diagram.width>0&&diagram.height>0);assert.ok(!diagram.svg.includes('<script>'));assert.match(diagram.svg,/&lt;script&gt;/);assert.match(diagram.svg,/data-source-line="8"/);assert.ok(!diagram.svg.includes('NaN'));}
});
test('no genera un diagrama ni exporta código con errores sintácticos',async()=>{
  const broken='Algoritmo Incompleto\nSi Verdadero Entonces\nEscribir 1\nFinAlgoritmo';
  assert.ok((await engine.diagram(broken)).errors.length);assert.ok((await engine.translate(broken,'Flexible','py3')).errors.length);
});
test('genera los 12 destinos del exportador original',async()=>{
  const sample='Algoritmo Suma\nDefinir i,total Como Entero\ntotal<-0\nPara i<-1 Hasta 3 Hacer\ntotal<-total+i\nFinPara\nEscribir total\nFinAlgoritmo';
  for(const lang of ['c','cpp','cs','java','js','html','py3','pas','php','m','vb','bas']){
    const result=await engine.translate(sample,'Flexible',lang);assert.deepEqual(result.errors,[],lang);assert.ok(result.text.length>50,lang);
  }
  const result=await engine.translate(sample,'Flexible','py3');
  const {spawnSync}=require('node:child_process');const run=spawnSync('python',['-c',result.text],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'6');
  await assert.rejects(engine.translate(sample,'Flexible','../../exe'),/no válido/);
});
test('todos los ejemplos pueden representarse en ambos estilos',async()=>{
  const {examples}=await import('../src/examples.js');const {parseDiagram,renderDiagram}=await import('../src/flowchart.js');
  for(const example of examples){const result=await engine.diagram(example.code);assert.deepEqual(result.errors,[]);for(const p of parseDiagram(result.text)){assert.ok(renderDiagram(p).nodes>0);assert.ok(renderDiagram(p,'nassi').nodes>0);}}
});
