// OAB Studio desktop bridge (only what the studio page needs)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('oabDesktop', {
  isDesktop: true,
  openYouTube: () => ipcRenderer.invoke('yt-open'),
  youTubeOpen: () => ipcRenderer.invoke('yt-is-open'),
  closeYouTube: () => ipcRenderer.invoke('yt-close')
});
