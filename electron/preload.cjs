const { contextBridge, ipcRenderer } = require('electron');
const invoke = name => (...args) => ipcRenderer.invoke(name, ...args);
contextBridge.exposeInMainWorld('studio', {
  diagram: invoke('engine:diagram'), translate: invoke('engine:translate'), saveArtifact: invoke('artifact:save'),
  openProject: invoke('workspace:open'), listProject: invoke('workspace:list'), readProject: invoke('workspace:read'), createProjectEntry: invoke('workspace:create'), closeProject: invoke('workspace:close'),
  init: invoke('init'), open: invoke('file:open'), save: invoke('file:save'), confirm: invoke('confirm'),
  run: invoke('engine:run'), check: invoke('engine:check'), input: invoke('engine:input'), stop: invoke('engine:stop'), debug: invoke('engine:debug'),
  extensions: invoke('extensions:list'), installExtension: invoke('extensions:install'), toggleExtension: invoke('extensions:toggle'),
  aiSettings: invoke('ai:settings'), saveAiSettings: invoke('ai:save'), askAI: invoke('ai:ask'), cancelAI: invoke('ai:cancel'),
  importFont: invoke('font:import'), window: invoke('window'), readyToClose: invoke('window:close-ready'),
  on: (name, callback) => {
    if (!['engine:output', 'engine:exit', 'engine:debug', 'window:closing'].includes(name)) return () => {};
    const handler = (_event, data) => callback(data); ipcRenderer.on(name, handler); return () => ipcRenderer.removeListener(name, handler);
  }
});
