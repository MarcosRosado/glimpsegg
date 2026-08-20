const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Store / Configuration API
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    getAll: () => ipcRenderer.invoke('store:getAll'),
  },

  // STRATZ GraphQL Proxy
  stratzQuery: (query, variables, customApiKey) =>
    ipcRenderer.invoke('api:stratz-graphql', { query, variables, customApiKey }),

  // OpenDota REST Proxy
  openDotaFetch: (endpoint) =>
    ipcRenderer.invoke('api:opendota-fetch', { endpoint }),

  // Steam ID Resolver
  resolveSteamId: (input) =>
    ipcRenderer.invoke('api:resolve-steam-id', { input }),

  // Window Controls
  windowControl: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // Auto Updater API
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onStatus: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('updater:progress', handler);
      return () => ipcRenderer.removeListener('updater:progress', handler);
    },
  },

  // App Info
  getPlatform: () => process.platform,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
