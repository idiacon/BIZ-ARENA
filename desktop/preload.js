const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('bizArenaDesktop', {
  isElectronShell: true,
});
