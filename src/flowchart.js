// Consume PSeInt's canonical --draw output, not a second parser of user syntax.
export function parseDiagram(text) {
  const tokens = []; let line = 1;
  for (const raw of text.split(/\r?\n/)) {
    const pos = raw.match(/^#pos (\d+):/); if (pos) { line=Number(pos[1]); continue; }
    if (raw.trim() && !raw.startsWith('#')) tokens.push({text:raw.trim(),line});
  }
  if (tokens.length>5000) throw new Error('El diagrama supera 5000 instrucciones. Divide el programa en archivos más pequeños.');
  let cursor=0;
  const peek=()=>tokens[cursor]?.text || '';
  const take=()=>tokens[cursor++];
  function sequence(stop,depth=0) {
    if(depth>80) throw new Error('Demasiados bloques anidados para dibujar.');
    const nodes=[];
    while(cursor<tokens.length && !stop(peek())) {
      const token=take(), t=token.text;
      if (/^SI /i.test(t)) {
        if (/^ENTONCES$/i.test(peek())) take();
        const yes=sequence(s=>/^(SINO|FINSI)$/i.test(s),depth+1); let no=[];
        if(/^SINO$/i.test(peek())) {take();no=sequence(s=>/^FINSI$/i.test(s),depth+1);}
        if(!/^FINSI$/i.test(peek())) throw new Error('Bloque SI incompleto en la salida del motor.'); take();
        nodes.push({...token,kind:'if',label:t.slice(3),yes,no});
      } else if (/^(MIENTRAS |PARA |PARACADA )/i.test(t)) {
        const isFor=/^PARA/i.test(t), end=isFor?'FINPARA':'FINMIENTRAS';
        const body=sequence(s=>s.toUpperCase()===end,depth+1);
        if(peek().toUpperCase()!==end) throw new Error('Bucle incompleto en la salida del motor.');take();
        nodes.push({...token,kind:'loop',label:t.replace(/ Hacer$/i,''),body,isFor});
      } else if (/^REPETIR$/i.test(t)) {
        const body=sequence(s=>/^(HASTA QUE |MIENTRAS QUE )/i.test(s),depth+1), condition=take();
        if(!condition) throw new Error('REPETIR incompleto.');
        nodes.push({...token,kind:'repeat',label:condition.text.replace(/^(HASTA QUE |MIENTRAS QUE )/i,''),conditionLine:condition.line,until:/^HASTA/i.test(condition.text),body});
      } else if (/^SEGUN /i.test(t)) {
        const branches=[];
        while(cursor<tokens.length && !/^FINSEGUN$/i.test(peek())) {
          const option=take();if(!option.text.endsWith(':')) throw new Error('Opción SEGUN no reconocida.');
          branches.push({label:option.text.slice(0,-1),body:sequence(s=>s.endsWith(':')||/^FINSEGUN$/i.test(s),depth+1)});
        }
        if(!/^FINSEGUN$/i.test(peek())) throw new Error('SEGUN incompleto.');take();
        if(!branches.some(b=>/^DE OTRO MODO$/i.test(b.label))) branches.push({label:'Otro caso',body:[]});
        nodes.push({...token,kind:'switch',label:t.replace(/^SEGUN /i,'').replace(/ Hacer$/i,''),branches});
      } else {
        nodes.push({...token,kind:/^(LEER|ESCRIBIR|ESCRIBNL) /i.test(t)?'io':/^INVOCAR /i.test(t)?'call':'action',label:t.replace(/;$/,'').replace(/^ESCRIBNL /i,'Escribir sin saltar ').replace(/^INVOCAR /i,'')});
      }
    }
    return nodes;
  }
  const programs=[];
  while(cursor<tokens.length) {
    const header=take();if(!/^(PROCESO |SUBPROCESO )/i.test(header.text)) throw new Error('Cabecera de proceso no reconocida.');
    const body=sequence(s=>/^(FINPROCESO|FINSUBPROCESO)$/i.test(s));const end=take();
    if(!end) throw new Error('Proceso sin cierre.');
    programs.push({name:header.text.replace(/^(PROCESO |SUBPROCESO )/i,''),main:/^PROCESO /i.test(header.text),line:header.line,endLine:end.line,body});
  }
  return programs;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lines(text,limit=34,max=5) {
  const chars=[...text],out=[];while(chars.length && out.length<max) out.push(chars.splice(0,limit).join(''));
  if(chars.length) out[max-1]=out[max-1].slice(0,-1)+'…';return out.length?out:[''];
}
function fragment(width,height) {return {width,height,nodes:[],edges:[],entry:[width/2,0],exit:[width/2,height]};}
function place(dest,child,x,y) {
  dest.nodes.push(...child.nodes.map(n=>({...n,x:n.x+x,y:n.y+y})));
  dest.edges.push(...child.edges.map(e=>({...e,points:e.points.map(p=>[p[0]+x,p[1]+y])})));
}
function edge(f,points,label='') {f.edges.push({points,label});}
function leaf(label,kind,line) {
  const text=lines(label,kind==='decision'?25:34), w=kind==='decision'?360:300,h=kind==='decision'?Math.max(110,text.length*30+60):Math.max(58,text.length*20+28);
  const f=fragment(w,h);f.nodes.push({x:w/2,y:0,w,h,kind,label,line,text});return f;
}
function junction(){const f=fragment(300,8);f.nodes.push({x:150,y:0,w:8,h:8,kind:'join',label:'',line:0,text:[]});return f;}
function sequenceLayout(nodes) {
  const parts=nodes.map(classic);if(!parts.length)return junction();
  const f=fragment(Math.max(...parts.map(p=>p.width)),parts.reduce((n,p)=>n+p.height,0)+40*(parts.length-1));let y=0,last;
  for(const part of parts){const x=(f.width-part.width)/2;if(last)edge(f,[last,[x+part.entry[0],y]]);place(f,part,x,y);last=[x+part.exit[0],y+part.exit[1]];y+=part.height+40;}
  f.entry=[f.width/2,0];f.exit=last;return f;
}
function classic(n) {
  if(n.kind==='if'||n.kind==='switch') {
    const opts=n.kind==='if'?[{label:'Sí',body:n.yes},{label:'No',body:n.no}]:n.branches;
    const branches=opts.map(o=>sequenceLayout(o.body)), head=leaf(n.kind==='switch'?'Según '+n.label:n.label,'decision',n.line);
    const width=Math.max(head.width+100,branches.reduce((v,b)=>v+b.width,0)+80*(branches.length-1));
    const top=head.height+70,bottom=top+Math.max(...branches.map(b=>b.height))+45,f=fragment(width,bottom+8);
    place(f,head,(width-head.width)/2,0);let x=(width-(branches.reduce((v,b)=>v+b.width,0)+80*(branches.length-1)))/2;
    branches.forEach((b,i)=>{place(f,b,x,top);const cx=x+b.entry[0];
      if(n.kind==='if') {const anchor=i===0?width/2-head.width/2:width/2+head.width/2;edge(f,[[anchor,head.height/2],[cx,head.height/2],[cx,top]],opts[i].label);}
      else edge(f,[[width/2,head.height],[width/2,top-35],[cx,top-35],[cx,top]],opts[i].label);
      edge(f,[[x+b.exit[0],top+b.exit[1]],[x+b.exit[0],bottom],[width/2,bottom]]);x+=b.width+80;});
    f.nodes.push({x:width/2,y:bottom,w:8,h:8,kind:'join',label:'',line:0,text:[]});return f;
  }
  if(n.kind==='loop'||n.kind==='repeat') {
    const body=sequenceLayout(n.body),head=leaf(n.label,n.isFor?'loop':'decision',n.conditionLine||n.line);
    const inner=Math.max(body.width,head.width),width=inner+180,cx=width/2;
    const f=fragment(width,head.height+body.height+125);
    if(n.kind==='repeat') {
      place(f,body,(width-body.width)/2,30);const hy=body.height+70;place(f,head,(width-head.width)/2,hy);
      edge(f,[[cx,0],[cx,30]]);edge(f,[[cx,30+body.height],[cx,hy]]);
      edge(f,[[cx-head.width/2,hy+head.height/2],[30,hy+head.height/2],[30,12],[cx,12]],n.until?'No':'Sí');
      edge(f,[[cx,hy+head.height],[cx,f.height]],n.until?'Sí':'No');
    } else {
      place(f,head,(width-head.width)/2,20);place(f,body,(width-body.width)/2,head.height+65);
      edge(f,[[cx,0],[cx,20]]);edge(f,[[cx,20+head.height],[cx,head.height+65]],'Sí');
      edge(f,[[cx,head.height+65+body.height],[cx, f.height-20],[30,f.height-20],[30,8],[cx,8]],n.isFor?'Siguiente':'');
      edge(f,[[cx+head.width/2,20+head.height/2],[width-30,20+head.height/2],[width-30,f.height],[cx,f.height]],'No');
    }return f;
  }
  return leaf(n.label,n.kind,n.line);
}
function nsWidth(nodes){return Math.max(260,...nodes.map(n=>n.kind==='if'?nsWidth(n.yes)+nsWidth(n.no):n.kind==='switch'?n.branches.reduce((w,b)=>w+nsWidth(b.body),0):n.body?nsWidth(n.body)+28:260));}
function nsSequence(nodes,width=680) {
  const f=fragment(width,0);let y=0;
  function rect(label,line,x,yy,w,h,kind='action'){f.nodes.push({x:x+w/2,y:yy,w,h,kind,label,line,text:lines(label,Math.max(12,Math.floor((w-30)/8)),4)});}
  for(const n of nodes) {
    if(n.kind==='if'||n.kind==='switch') {
      const opts=n.kind==='if'?[{label:'Sí',body:n.yes},{label:'No',body:n.no}]:n.branches;
      const col=width/opts.length,parts=opts.map(o=>nsSequence(o.body,col));const h=Math.max(45,...parts.map(p=>p.height));
      rect(n.kind==='switch'?'Según '+n.label:n.label,n.line,0,y,width,95,n.kind==='if'?'nsif':'nsdecision');y+=95;
      opts.forEach((o,i)=>{rect(o.label,0,i*col,y,col,38,'nsbranch');place(f,parts[i],i*col,y+38);rect('',0,i*col,y+38+parts[i].height,col,h-parts[i].height,'nsblank');});y+=38+h;
    }else if(n.kind==='loop'||n.kind==='repeat') {
      const body=nsSequence(n.body,Math.max(120,width-28));const h=body.height+70;
      rect('',n.line,0,y,width,h,'nsblank');
      if(n.kind==='repeat'){place(f,body,28,y);rect((n.until?'Hasta que ':'Mientras que ')+n.label,n.conditionLine,28,y+body.height,width-28,70,'nsdecision');}
      else {rect(n.label,n.line,0,y,width,70,'nsdecision');place(f,body,28,y+70);}y+=h;
    }else {const text=lines(n.label,Math.max(12,Math.floor((width-30)/8)),4);const h=Math.max(55,text.length*20+20);rect(n.label,n.line,0,y,width,h,n.kind==='io'?'nsio':'action');y+=h;}
  }
  f.height=y;return f;
}
export function renderDiagram(program,style='classic') {
  const content=style==='nassi'?nsSequence(program.body,Math.max(680,nsWidth(program.body))):sequenceLayout([{kind:'start',label:program.name,line:program.line},...program.body,{kind:'end',label:'Fin',line:program.endLine}]);
  if(style==='nassi'){content.nodes.unshift({x:content.width/2,y:-65,w:content.width,h:65,kind:'start',label:program.name,line:program.line,text:lines(program.name,65,2)});}
  const offset=style==='nassi'?105:40,width=content.width+80,height=content.height+offset+40;
  const nodeSVG=n=>{
    const x=n.x+40,y=n.y+offset,l=x-n.w/2,r=x+n.w/2,b=y+n.h,mid=y+n.h/2;
    let shape=n.kind==='join'?`<circle cx="${x}" cy="${mid}" r="4"/>`:n.kind==='decision'?`<polygon points="${x},${y} ${r},${mid} ${x},${b} ${l},${mid}"/>`:n.kind==='io'?`<polygon points="${l+18},${y} ${r},${y} ${r-18},${b} ${l},${b}"/>`:n.kind==='loop'?`<polygon points="${l+20},${y} ${r-20},${y} ${r},${mid} ${r-20},${b} ${l+20},${b} ${l},${mid}"/>`:`<rect x="${l}" y="${y}" width="${n.w}" height="${n.h}" rx="${['start','end'].includes(n.kind)?n.h/2:style==='nassi'?0:7}"/>`;
    if(n.kind==='nsif')shape+=`<path d="M ${l} ${y} L ${x} ${b} L ${r} ${y}" style="fill:none"/>`;
    if(n.kind==='call')shape+=`<path d="M ${l+12} ${y} V ${b} M ${r-12} ${y} V ${b}"/>`;
    return `<g class="flow-node ${n.kind}" data-source-line="${n.line}" ${n.line?'tabindex="0" role="button"':''} aria-label="${esc(n.label)}"><title>${esc(n.label)}${n.line?' · Línea '+n.line:''}</title>${shape}<text x="${x}" y="${n.kind==='nsif'?y+25:mid-(n.text.length-1)*10+5}" text-anchor="middle">${n.text.map((t,i)=>`<tspan x="${x}" dy="${i?20:0}">${esc(t)}</tspan>`).join('')}</text></g>`;
  };
  const edges=content.edges.map(e=>{const pts=e.points.map(([x,y])=>[x+40,y+offset]),labelPoint=pts.length>2?pts[1]:[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2];return `<polyline class="flow-edge" points="${pts.map(p=>p.join(',')).join(' ')}" marker-end="url(#arrow)"/>${e.label?`<text class="edge-label" x="${labelPoint[0]+8}" y="${labelPoint[1]-8}">${esc(e.label)}</text>`:''}`;}).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Flujograma ${esc(program.name)}"><title>${esc(program.name)}</title><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#74839d"/></marker></defs><style>.flow-node{cursor:pointer}.flow-node rect,.flow-node polygon,.flow-node circle,.flow-node path{fill:#202b41;stroke:#91a4c3;stroke-width:1.6}.flow-node text{fill:#eef3ff;font:14px Consolas,monospace;pointer-events:none}.flow-node.decision polygon,.flow-node.nsdecision rect,.flow-node.nsif rect{fill:#352d46;stroke:#c4a0ef}.flow-node.io polygon,.flow-node.nsio rect{fill:#173b42;stroke:#66d9ce}.flow-node.start rect,.flow-node.end rect{fill:#28395c;stroke:#a9baff}.flow-node.join circle{fill:#91a4c3}.flow-node:hover rect,.flow-node:hover polygon{stroke:#fff;stroke-width:2.5}.flow-node.executing rect,.flow-node.executing polygon{fill:#315329;stroke:#b5e59c;stroke-width:3}.flow-edge{fill:none;stroke:#74839d;stroke-width:1.7}.edge-label{fill:#b9c8df;font:13px Consolas,monospace;paint-order:stroke;stroke:#111827;stroke-width:4}</style><rect width="100%" height="100%" fill="#111827"/>${edges}${content.nodes.map(nodeSVG).join('')}</svg>`;
  return {svg,width,height,nodes:content.nodes.length};
}
