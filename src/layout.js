export function createLayout() {
  const $ = id => document.getElementById(id);
  const defaults = { sidebar:true, terminal:true, ai:false, sidebarWidth:227, aiWidth:330, terminalHeight:230, terminalWidth:380, side:'left', dock:'bottom' };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('layout')) || {}; } catch {}
  let state = {...defaults, ...saved}, focused = false, panelMaximized = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
  function apply(persist = true) {
    const side = state.sidebar && !focused, ai = state.ai && !focused, terminal = state.terminal && !focused;
    let sideWidth = clamp(state.sidebarWidth,170,450), aiWidth = clamp(state.aiWidth,250,500);
    const room = Math.max(200, window.innerWidth - 480);
    const total = (side ? sideWidth : 0) + (ai ? aiWidth : 0);
    if (total > room) { const scale = room / total; sideWidth *= scale; aiWidth *= scale; }
    const style = document.documentElement.style;
    style.setProperty('--sidebar-width',sideWidth+'px'); style.setProperty('--ai-width',aiWidth+'px');
    style.setProperty('--console-height',clamp(state.terminalHeight,120,window.innerHeight*.65)+'px');
    style.setProperty('--console-width',clamp(state.terminalWidth,260,Math.max(260,$('editor-column').clientWidth*.65))+'px');
    for (const [id, show] of [['sidebar',side],['sidebar-resizer',side],['ai-panel',ai],['ai-resizer',ai],['bottom-panel',terminal],['panel-resizer',terminal && !panelMaximized]]) $(id).classList.toggle('hidden',!show);
    $('editor-main').classList.toggle('hidden',terminal && panelMaximized);
    $('editor-column').classList.toggle('terminal-right',state.dock === 'right');
    $('editor-column').classList.toggle('terminal-maximized',terminal && panelMaximized);
    document.querySelector('.workspace').classList.toggle('explorer-right', state.side === 'right');
    $('panel-resizer').setAttribute('aria-orientation', state.dock === 'right' ? 'vertical' : 'horizontal');
    $('ai-toggle').classList.toggle('active',ai);
    for (const key of ['sidebar','terminal','ai']) $('layout-'+key).checked = state[key];
    $('layout-side').value = state.side; $('layout-dock').value = state.dock;
    if (persist) localStorage.setItem('layout',JSON.stringify(state));
  }
  function showTerminal() { focused = false; state.terminal = true; apply(); }
  function toggle(name, force) { focused = false; state[name] = force ?? !state[name]; if(name==='terminal') panelMaximized=false; apply(); }
  function focusEditor() { focused = !focused; panelMaximized = false; apply(false); }
  $('layout-open').onclick = () => { apply(false); $('layout-dialog').showModal(); };
  for (const key of ['sidebar','terminal','ai']) $('layout-'+key).onchange = event => toggle(key,event.target.checked);
  for (const key of ['side','dock']) $('layout-'+key).onchange = event => { state[key]=event.target.value; panelMaximized=false; apply(); };
  $('layout-focus').onclick = () => { focusEditor(); $('layout-dialog').close(); };
  $('layout-reset').onclick = () => { state={...defaults}; focused=false; panelMaximized=false; apply(); };
  $('panel-hide').onclick = () => toggle('terminal',false);
  $('panel-maximize').onclick = () => { panelMaximized=!panelMaximized; apply(false); };
  function splitter(id, getKey, delta) {
    const node = $(id);
    node.onpointerdown = event => {
      if (event.button !== 0) return;
      event.preventDefault(); const key=getKey(), initial=Number(state[key]), x=event.clientX, y=event.clientY;
      node.setPointerCapture(event.pointerId); document.body.classList.add('resizing');
      const update = e => { state[key]=clamp(initial+delta(e.clientX-x,e.clientY-y),key==='terminalHeight'?120:170,key==='terminalHeight'?window.innerHeight*.65:window.innerWidth*.6); apply(false); };
      const finish = () => { node.onpointermove=null; node.onpointerup=null; node.onpointercancel=null; document.body.classList.remove('resizing'); apply(); };
      node.onpointermove=update; node.onpointerup=finish; node.onpointercancel=finish;
    };
    node.ondblclick = () => { const key=getKey(); state[key]=defaults[key]; apply(); };
    node.onkeydown = e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault(); const key=getKey(); state[key]+=delta(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0,e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0); apply(); };
  }
  splitter('sidebar-resizer',()=> 'sidebarWidth',(x)=>state.side==='right'?-x:x);
  splitter('ai-resizer',()=> 'aiWidth',(x)=>-x);
  splitter('panel-resizer',()=>state.dock==='right'?'terminalWidth':'terminalHeight',(x,y)=>state.dock==='right'?-x:-y);
  window.addEventListener('resize',()=>apply(false));
  apply(false);
  return { toggle, showTerminal, focusEditor };
}
