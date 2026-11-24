// OAB Studio desktop bridge (only what the studio page needs)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('oabDesktop', {
  isDesktop: true,
  openYouTube: () => ipcRenderer.invoke('yt-open'),
  youTubeOpen: () => ipcRenderer.invoke('yt-is-open'),
  closeYouTube: () => ipcRenderer.invoke('yt-close'),
  pcDevices: () => ipcRenderer.invoke('pc-devices'),
  pcRoute: on => ipcRenderer.invoke('pc-route', !!on),
  pcRouteTarget: () => ipcRenderer.invoke('pc-route-target')
});
