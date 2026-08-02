const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function startBackendServer() {
  console.log('Starting backend server...');
  
  const isDev = process.env.NODE_ENV === 'development';
  const backendPath = isDev 
    ? path.join(__dirname, '../backend')
    : path.join(process.resourcesPath, 'backend');
  
  // Check if backend exists
  const fs = require('fs');
  if (!fs.existsSync(backendPath)) {
    console.error('Backend not found at:', backendPath);
    return;
  }
  
  const backendScript = path.join(backendPath, 'dist', 'server.js');
  
  if (!fs.existsSync(backendScript)) {
    console.error('Backend script not found at:', backendScript);
    return;
  }
  
  // Start the backend server
  backendProcess = spawn('node', [backendScript], {
    cwd: backendPath,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
      FRONTEND_URL: 'http://localhost:3000'
    }
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
  
  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function stopBackendServer() {
  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    // icon: path.join(__dirname, '../public/vite.svg'), // Disabled for build compatibility
    title: 'OpenMaps - Open Source Maps',
    show: false
  });

  console.log('Loading app...');
  mainWindow.loadFile('dist/index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Only open dev tools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
    
    console.log('App loaded successfully');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
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
              message: `OpenMaps v${app.getVersion()}`,
              detail: 'Interactive offline-capable map application\nFeatures: Dynamic Location Explorer, Offline Routing, Map Pack System\nBuilt with React, Leaflet, TypeScript, and Electron\n\nDeveloped by the OpenMaps Team'
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  
  // Start backend server first
  startBackendServer();
  
  // Wait a moment for backend to start, then create window
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

app.setAsDefaultProtocolClient('openmaps');

app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('app-quit', () => {
  app.quit();
});