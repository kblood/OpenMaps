// Enhanced Electron Main Process with Network Filtering
// This version restricts network access to only tile servers and local backend

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// Allowed domains for network access
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'nominatim.openstreetmap.org',
  'router.project-osrm.org',
  'overpass-api.de',
  'overpass.kumi.systems',
  // Add more tile servers as needed
];

// Optional: Block all external requests (full offline mode)
const OFFLINE_MODE = false; // Set to true for complete offline

function isAllowedUrl(url) {
  if (OFFLINE_MODE) {
    // In full offline mode, only allow localhost
    return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
  }
  
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

function startBackend() {
  console.log('🚀 Starting embedded backend server...');
  
  const backendPath = path.join(__dirname, '../backend/dist/server.js');
  const backendDir = path.join(__dirname, '../backend');
  
  backendProcess = spawn('node', [backendPath], {
    cwd: backendDir,
    env: { ...process.env, PORT: '3001', NODE_ENV: 'production' }
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data.toString().trim()}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
  
  // Wait for backend to start
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ Backend should be ready');
      resolve();
    }, 3000);
  });
}

function setupNetworkFiltering() {
  // Set up request filter
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    
    // Always allow data URLs and blob URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      callback({ cancel: false });
      return;
    }
    
    // Check if URL is allowed
    const allowed = isAllowedUrl(url);
    
    if (!allowed) {
      console.log(`🚫 Blocked request to: ${url}`);
    }
    
    callback({ cancel: !allowed });
  });
  
  // Log network requests (for debugging)
  session.defaultSession.webRequest.onCompleted((details) => {
    if (details.statusCode >= 400) {
      console.log(`⚠️ Request failed: ${details.url} (${details.statusCode})`);
    }
  });
  
  console.log('🔒 Network filtering enabled');
  console.log(`📋 Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  console.log(`🔌 Offline mode: ${OFFLINE_MODE ? 'ENABLED' : 'DISABLED'}`);
}

async function createWindow() {
  // Start backend first
  await startBackend();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Disable web security in development (for CORS)
      webSecurity: process.env.NODE_ENV === 'production'
    },
    icon: path.join(__dirname, '../public/icons/icon-512.png'),
    title: 'OpenMaps - Offline Maps (Limited Network)',
    show: false,
    backgroundColor: '#1a1a1a'
  });

  // Set up network filtering
  setupNetworkFiltering();

  console.log('📂 Loading app from:', path.join(__dirname, '../dist/index.html'));
  
  // Load the app
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (process.env.NODE_ENV !== 'production') {
      mainWindow.webContents.openDevTools();
    }
    
    console.log('✅ App loaded successfully');
    
    // Show info dialog about network restrictions
    if (!OFFLINE_MODE) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Network Access Information',
        message: 'Limited Network Mode',
        detail: `This app has restricted network access.\n\nAllowed domains:\n${ALLOWED_DOMAINS.slice(0, 5).join('\n')}\n...and ${ALLOWED_DOMAINS.length - 5} more.\n\nAll other external requests are blocked for privacy and security.`,
        buttons: ['OK']
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Offline Mode',
        message: 'Full Offline Mode Enabled',
        detail: 'This app is running in complete offline mode.\nOnly localhost connections are allowed.\n\nEnsure you have downloaded map packs before using offline.',
        buttons: ['OK']
      });
    }
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorCode, errorDescription);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      shell.openExternal(url);
    } else {
      console.log(`🚫 Blocked external link: ${url}`);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'About OpenMaps',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About OpenMaps',
              message: 'OpenMaps v1.0.0 - Desktop Edition',
              detail: 'Open source offline maps application\n\nFeatures:\n• Limited network access\n• Offline tile caching\n• Local backend server\n• Privacy-focused\n\nBuilt with React, Leaflet, Electron, and Node.js'
            });
          }
        },
        {
          label: 'Network Status',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Network Status',
              message: OFFLINE_MODE ? 'Full Offline Mode' : 'Limited Network Mode',
              detail: OFFLINE_MODE 
                ? 'Only localhost connections allowed.\nAll external requests blocked.'
                : `Allowed domains:\n${ALLOWED_DOMAINS.join('\n')}\n\nAll other domains blocked.`
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Offline Mode',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'question',
              title: 'Restart Required',
              message: 'Offline mode toggle requires restart',
              detail: 'Edit electron/main-secure.js and change OFFLINE_MODE constant.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Storage',
      submenu: [
        {
          label: 'Clear Cache',
          click: async () => {
            const response = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              title: 'Clear Cache',
              message: 'Clear all cached map tiles?',
              detail: 'This will remove all downloaded map packs.\nYou can re-download them later.',
              buttons: ['Cancel', 'Clear Cache'],
              defaultId: 0,
              cancelId: 0
            });
            
            if (response.response === 1) {
              await session.defaultSession.clearStorageData({
                storages: ['indexeddb', 'localstorage']
              });
              
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Cache Cleared',
                message: 'All cached data has been cleared.',
                detail: 'Please restart the application.'
              });
            }
          }
        },
        {
          label: 'View Storage Info',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              navigator.storage.estimate().then(estimate => {
                const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
                const quotaMB = (estimate.quota / 1024 / 1024).toFixed(0);
                const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
                return 'Storage Used: ' + usedMB + ' MB / ' + quotaMB + ' MB (' + percent + '%)';
              });
            `).then(result => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Storage Information',
                message: 'Local Storage Usage',
                detail: result
              });
            });
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Help',
              message: 'OpenMaps Documentation',
              detail: 'Quick Tips:\n\n1. Download map packs before going offline\n2. Use Map Pack Manager (🗺️) to download areas\n3. Enable offline mode in DevTools to test\n4. Check Storage menu to view cached data\n\nFor full documentation, see README.md'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createMenu();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    console.log('🛑 Stopping backend server...');
    backendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Handle crashes
app.on('render-process-gone', (event, webContents, details) => {
  console.error('❌ Render process crashed:', details);
});

// IPC handlers
ipcMain.handle('get-network-status', () => {
  return {
    offlineMode: OFFLINE_MODE,
    allowedDomains: ALLOWED_DOMAINS
  };
});

console.log('🚀 OpenMaps Desktop starting...');
console.log(`📍 Mode: ${OFFLINE_MODE ? 'Full Offline' : 'Limited Network'}`);
console.log(`📂 App path: ${app.getAppPath()}`);
