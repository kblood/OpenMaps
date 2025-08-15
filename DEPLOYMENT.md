# OpenMaps Deployment Guide

This guide provides detailed instructions for deploying OpenMaps as a standalone application across different platforms and environments.

## Table of Contents

1. [Progressive Web App (PWA)](#progressive-web-app-pwa)
2. [Desktop Applications](#desktop-applications)
3. [Mobile Applications](#mobile-applications)
4. [Self-Contained Deployments](#self-contained-deployments)
5. [Offline-First Configuration](#offline-first-configuration)

## Progressive Web App (PWA)

### Overview
Transform OpenMaps into an installable PWA with offline capabilities.

### Implementation Steps

#### 1. Add Web App Manifest

Create `public/manifest.json`:
```json
{
  "name": "OpenMaps",
  "short_name": "OpenMaps",
  "description": "Open source Google Maps alternative",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#3B82F6",
  "background_color": "#FFFFFF",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 2. Create Service Worker

Create `public/sw.js`:
```javascript
const CACHE_NAME = 'openmaps-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch with cache-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
```

#### 3. Update Build Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "build:pwa": "npm run build && npm run generate-sw",
    "generate-sw": "workbox generateSW workbox-config.js"
  },
  "devDependencies": {
    "workbox-cli": "^6.5.0"
  }
}
```

#### 4. PWA Configuration

Create `workbox-config.js`:
```javascript
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{html,js,css,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
  swDest: 'dist/sw.js',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        }
      }
    }
  ]
};
```

## Desktop Applications

### Tauri Implementation (Recommended)

#### 1. Install Tauri
```bash
npm install --save-dev @tauri-apps/cli
cargo install tauri-cli
```

#### 2. Initialize Tauri
```bash
npm run tauri init
```

#### 3. Configure Tauri

Update `src-tauri/tauri.conf.json`:
```json
{
  "build": {
    "distDir": "../dist",
    "devPath": "http://localhost:3000"
  },
  "package": {
    "productName": "OpenMaps",
    "version": "1.0.0"
  },
  "tauri": {
    "bundle": {
      "identifier": "com.openmaps.app",
      "targets": ["deb", "appimage", "msi", "app", "dmg"]
    }
  }
}
```

#### 4. Build Scripts
```json
{
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "build:desktop": "npm run build && npm run tauri:build"
  }
}
```

### Electron Implementation

#### 1. Install Electron
```bash
npm install --save-dev electron electron-builder
```

#### 2. Create Main Process

Create `electron/main.js`:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  mainWindow.loadURL(
    isDev 
      ? 'http://localhost:3000' 
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );
}

app.whenReady().then(() => {
  createWindow();
});
```

#### 3. Configure Electron Builder

Add to `package.json`:
```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "NODE_ENV=development electron .",
    "electron:build": "electron-builder",
    "build:electron": "npm run build && npm run electron:build"
  },
  "build": {
    "appId": "com.openmaps.app",
    "productName": "OpenMaps",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ]
  }
}
```

## Mobile Applications

### Capacitor Implementation

#### 1. Install Capacitor
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

#### 2. Initialize Capacitor
```bash
npx cap init OpenMaps com.openmaps.app
```

#### 3. Configure Capacitor

Update `capacitor.config.json`:
```json
{
  "appId": "com.openmaps.app",
  "appName": "OpenMaps",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "plugins": {
    "Geolocation": {
      "permissions": ["location"]
    }
  }
}
```

#### 4. Add Platforms
```bash
npx cap add ios
npx cap add android
```

#### 5. Build Scripts
```json
{
  "scripts": {
    "build:mobile": "npm run build && npx cap sync",
    "open:ios": "npx cap open ios",
    "open:android": "npx cap open android"
  }
}
```

## Self-Contained Deployments

### Docker Container

#### 1. Multi-stage Dockerfile

Create `Dockerfile.standalone`:
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Backend build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built applications
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend/dist ./backend/dist

# Start script
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
```

#### 2. Docker Entrypoint

Create `docker-entrypoint.sh`:
```bash
#!/bin/sh
# Start backend
node backend/dist/server.js &

# Serve frontend
npx serve -s dist -l 3000
```

### Static Bundle with Embedded Server

#### 1. Create Embedded Server

Create `scripts/embedded-server.js`:
```javascript
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../dist')));

// API routes (simplified)
app.get('/api/*', (req, res) => {
  res.json({ message: 'API endpoint - implement as needed' });
});

// Catch all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`OpenMaps running on http://localhost:${PORT}`);
});
```

#### 2. Package with pkg

```bash
npm install -g pkg
pkg scripts/embedded-server.js --out-path release/
```

## Offline-First Configuration

### Local Tile Storage

#### 1. Tile Download Script

Create `scripts/download-tiles.js`:
```javascript
const fs = require('fs');
const https = require('https');
const path = require('path');

const downloadTile = (z, x, y, outputDir) => {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const filepath = path.join(outputDir, z.toString(), x.toString(), `${y}.png`);
  
  // Create directories
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  
  const file = fs.createWriteStream(filepath);
  https.get(url, (response) => {
    response.pipe(file);
  });
};

// Download tiles for specific region
const downloadRegion = (north, south, east, west, minZoom, maxZoom) => {
  for (let z = minZoom; z <= maxZoom; z++) {
    // Calculate tile bounds and download
    // Implementation depends on specific requirements
  }
};
```

### Embedded Routing Engine

#### 1. OSRM Integration

```bash
# Download OSRM data files
wget http://download.geofabrik.de/your-region.osm.pbf

# Build OSRM files
osrm-extract your-region.osm.pbf
osrm-contract your-region.osrm
```

#### 2. Bundle with Application

Include OSRM files in the application bundle and start local OSRM server:

```javascript
const { spawn } = require('child_process');

const startOSRM = () => {
  const osrm = spawn('osrm-routed', ['--algorithm', 'mld', 'data/region.osrm']);
  return osrm;
};
```

## Build Scripts Summary

Add these comprehensive build scripts to `package.json`:

```json
{
  "scripts": {
    // Development
    "dev": "vite",
    "dev:backend": "cd backend && npm run dev",
    
    // Standard builds
    "build": "tsc && vite build",
    "build:backend": "cd backend && npm run build",
    
    // Standalone builds
    "build:pwa": "npm run build && workbox generateSW",
    "build:electron": "npm run build && electron-builder",
    "build:tauri": "npm run build && tauri build",
    "build:mobile": "npm run build && cap sync",
    "build:docker": "docker build -f Dockerfile.standalone -t openmaps-standalone .",
    
    // Development servers
    "electron:dev": "NODE_ENV=development electron .",
    "tauri:dev": "tauri dev",
    
    // Platform specific
    "open:ios": "cap open ios",
    "open:android": "cap open android"
  }
}
```

This deployment guide provides comprehensive instructions for creating standalone versions of OpenMaps across all major platforms and deployment scenarios.