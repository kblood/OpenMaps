const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // App controls
  quit: () => ipcRenderer.invoke('app-quit'),
  
  // Platform info
  platform: process.platform,
  
  // Environment info
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Versions
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// DOM Content Loaded event
window.addEventListener('DOMContentLoaded', () => {
  // Add Electron-specific styles or behaviors
  document.body.classList.add('electron-app');
  
  // Set app version in title if needed
  ipcRenderer.invoke('app-version').then(version => {
    document.title = `OpenMaps v${version}`;
  });
});