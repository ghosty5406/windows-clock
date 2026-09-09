const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clock', {
  onConfig: (cb) => ipcRenderer.on('config', (_e, payload) => cb(payload)),
  wake: () => ipcRenderer.send('user-activity')
});
