// OAB Studio desktop bridge (only what the studio page needs)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('oabDesktop', {
  isDesktop: true,
  platform: process.platform,
  openYouTube: () => ipcRenderer.invoke('yt-open'),
  youTubeOpen: () => ipcRenderer.invoke('yt-is-open'),
  closeYouTube: () => ipcRenderer.invoke('yt-close'),
  // all computer sound through OAB (VB-Cable) – Windows only
  pcDevices: process.platform === 'win32' ? () => ipcRenderer.invoke('pc-devices') : undefined,
  pcRoute: process.platform === 'win32' ? on => ipcRenderer.invoke('pc-route', !!on) : undefined,
  pcRouteTarget: process.platform === 'win32' ? () => ipcRenderer.invoke('pc-route-target') : undefined
});
