import {parseDiagram,renderDiagram} from './flowchart';
export function createDiagrams({api,getDocument,getProfile,onProblems,onLine,toast}) {
  const $=id=>document.getElementById(id);let visible=false,ticket=0,timer,programs=[],generated=null,source=null,scale=1,debugLine=null;
  const matches=doc=>source && doc && source.id===doc.id && source.content===doc.content && source.profile===getProfile();
  const safe=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>toast(e.message,true));
  function exportState(enabled){$('flow-svg').disabled=$('flow-png').disabled=!enabled;}
  function zoom(value){scale=Math.max(.08,Math.min(2.5,value));const svg=$('diagram-canvas').querySelector('svg');if(svg&&generated){svg.style.width=generated.width*scale+'px';svg.style.height=generated.height*scale+'px';}$('flow-zoom').textContent=Math.round(scale*100)+'%';}
  function fit(){if(generated)zoom(Math.min(1,($('diagram-scroll').clientWidth-25)/generated.width));}
  function paint(autofit=true){
    const program=programs[Number($('flow-process').value)];if(!program)return;
    generated=renderDiagram(program,$('flow-style').value);$('diagram-canvas').innerHTML=generated.svg;
    $('flow-status').textContent=`${program.name} · ${generated.nodes} bloques · Línea ${program.line} a ${program.endLine}`;
    exportState(true);autofit?fit():zoom(scale);if(debugLine)highlight(debugLine,false);
  }
  async function refresh(){
    if(!visible)return;const doc=getDocument();if(!doc)return;const request=++ticket,profile=getProfile();
    exportState(false);generated=null;programs=[];$('diagram-canvas').innerHTML='';$('flow-process').replaceChildren();$('flow-status').textContent='Analizando con PSeInt…';
    try {
      const result=await api.diagram(doc.content,profile);
      if(request!==ticket || getDocument()?.id!==doc.id || getDocument()?.content!==doc.content || getProfile()!==profile)return;
      onProblems(result.errors);
      if(result.errors.length){$('flow-status').textContent='Corrige los errores de sintaxis para generar el diagrama. Consulta Problemas.';return;}
      programs=parseDiagram(result.text);if(!programs.length)throw new Error('El archivo no contiene algoritmos para dibujar.');
      programs.forEach((p,i)=>$('flow-process').add(new Option((p.main?'Algoritmo: ':'Subproceso: ')+p.name,String(i))));
      $('flow-process').value=String(Math.max(0,programs.findIndex(p=>p.main)));
      source={...doc,profile};paint();
    }catch(e){if(request===ticket){$('flow-status').textContent=e.message;exportState(false);}}
  }
  function code(){visible=false;ticket++;clearTimeout(timer);$('diagram-view').classList.add('hidden');$('editor').classList.remove('hidden');$('flow-open').classList.remove('active');}
  async function show(){visible=true;$('editor').classList.add('hidden');$('diagram-view').classList.remove('hidden');$('flow-open').classList.add('active');if(matches(getDocument())&&programs.length)paint();else await refresh();}
  function changed(){ticket++;source=null;generated=null;exportState(false);clearTimeout(timer);if(visible){$('diagram-canvas').innerHTML='';$('flow-status').textContent='El código cambió. Actualizando…';timer=setTimeout(refresh,650);}}
  function highlight(line,scroll=true){
    debugLine=line;if(!visible || !matches(getDocument()))return;
    const index=programs.findIndex(p=>line>=p.line&&line<=p.endLine);
    if(index>=0&&Number($('flow-process').value)!==index){$('flow-process').value=String(index);paint();}
    for(const node of $('diagram-canvas').querySelectorAll('[data-source-line]'))node.classList.toggle('executing',Number(node.dataset.sourceLine)===line);
    if(scroll)$('diagram-canvas').querySelector('.executing')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function clearDebug(){debugLine=null;for(const n of $('diagram-canvas').querySelectorAll('.executing'))n.classList.remove('executing');}
  async function save(format){
    if(!generated||!matches(getDocument()))throw new Error('Actualiza el diagrama antes de exportar.');
    const image=generated,name=getDocument().name.replace(/\.psc$/i,'')+'-'+programs[Number($('flow-process').value)].name.replace(/[^\wáéíóúñ-]/gi,'_');
    let content=image.svg;
    if(format==='png'){
      const ratio=Math.min(2,8192/image.width,8192/image.height,Math.sqrt(20_000_000/(image.width*image.height)));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
      const url=URL.createObjectURL(new Blob([image.svg],{type:'image/svg+xml'}));
      try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No se pudo generar la imagen.'));img.src=url;});canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);content=canvas.toDataURL('image/png');}
      finally{URL.revokeObjectURL(url);}
      if(ratio<1)toast('PNG reducido para un diagrama grande. SVG conserva todos los detalles.');
    }
    if(await api.saveArtifact({name,extension:format,content}))toast('Diagrama exportado.');
  }
  $('flow-open').onclick=safe(()=>visible?code():show());$('flow-code').onclick=code;$('flow-refresh').onclick=safe(refresh);
  $('flow-process').onchange=$('flow-style').onchange=()=>paint();$('flow-minus').onclick=()=>zoom(scale/1.2);$('flow-plus').onclick=()=>zoom(scale*1.2);$('flow-fit').onclick=fit;$('flow-fit-all').onclick=()=>{if(generated)zoom(Math.min(1,($('diagram-scroll').clientWidth-25)/generated.width,($('diagram-scroll').clientHeight-25)/generated.height));};
  $('flow-svg').onclick=safe(()=>save('svg'));$('flow-png').onclick=safe(()=>save('png'));
  const visit=event=>{const node=event.target.closest('[data-source-line]');if(node&&Number(node.dataset.sourceLine)>0){const line=Number(node.dataset.sourceLine);code();onLine(line);}};
  $('diagram-canvas').onclick=visit;$('diagram-canvas').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();visit(e);}};
  $('diagram-scroll').addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom(scale*(e.deltaY>0?1/1.12:1.12));}},{passive:false});
  $('diagram-scroll').onpointerdown=e=>{if(e.button!==0||e.target.closest('[data-source-line]'))return;const node=$('diagram-scroll'),x=e.clientX,y=e.clientY,l=node.scrollLeft,t=node.scrollTop;node.setPointerCapture(e.pointerId);node.classList.add('dragging');node.onpointermove=v=>{node.scrollLeft=l+x-v.clientX;node.scrollTop=t+y-v.clientY;};node.onpointerup=node.onpointercancel=()=>{node.onpointermove=null;node.classList.remove('dragging');};};
  exportState(false);
  let exportTicket=0,converted=null;
  async function convert(){
    const request=++exportTicket,doc=getDocument(),profile=getProfile(),language=$('export-language').value;
    converted=null;$('export-save').disabled=true;$('export-preview').value='';$('export-status').textContent='Convirtiendo…';
    try{const result=await api.translate(doc.content,profile,language);if(request!==exportTicket)return;
      if(getDocument()?.id!==doc.id||getDocument()?.content!==doc.content)throw new Error('El documento cambió. Vuelve a abrir Exportar.');
      onProblems(result.errors);if(result.errors.length)throw new Error('Corrige los errores del programa antes de exportar.');
      converted={...result,name:doc.name};$('export-preview').value=result.text;$('export-status').textContent='Vista previa · '+doc.name;$('export-save').disabled=false;
    }catch(e){if(request===exportTicket)$('export-status').textContent=e.message;}
  }
  $('export-code').onclick=safe(async()=>{$('export-dialog').showModal();await convert();});$('export-language').onchange=safe(convert);
  $('export-dialog').addEventListener('close',()=>{exportTicket++;converted=null;});
  $('export-save').onclick=safe(async()=>{if(converted&&await api.saveArtifact({name:converted.name,extension:converted.extension,content:converted.text}))toast('Programa exportado.');});
  return {show,code,changed,highlight,clearDebug};
}
