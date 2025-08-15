# OpenMaps Electron Desktop Build Guide

## Quick Start

### Using the Batch File (Windows)
Simply double-click `build-electron-desktop.bat` or run it from command line:
```cmd
build-electron-desktop.bat
```

### Manual Build Process
```cmd
# Install dependencies
npm install
cd backend && npm install && cd ..

# Install Electron dependencies
npm install --save-dev electron electron-builder cross-env

# Build the application
npm run build
npm run build:backend
npm run build:electron-win
```

## Build Output

The build process creates several files in `release/OpenMaps-Desktop-v{version}/`:

### Windows Build Files
- **`OpenMaps Setup {version}.exe`** - Full installer that installs to Program Files
- **`OpenMaps {version}.exe`** - Portable executable that runs without installation
- **`latest.yml`** - Auto-updater configuration file

## Build Configuration

The Electron build is configured in `package.json` under the `"build"` section:

```json
{
  "build": {
    "appId": "com.openmaps.app",
    "productName": "OpenMaps",
    "directories": {
      "output": "release/OpenMaps-Desktop-v${version}"
    }
  }
}
```

## Customization Options

### App Icons
Place your custom icons in `public/icons/`:
- `icon-512.png` - Main application icon (512x512 pixels)
- `icon-256.png` - Medium size icon (256x256 pixels)
- `icon-128.png` - Small size icon (128x128 pixels)

### App Information
Edit these fields in `package.json`:
- `name` - Package name (lowercase, no spaces)
- `productName` - Display name (shown to users)
- `version` - Application version (affects output folder name)
- `description` - App description
- `author` - Your name/organization

### Build Options
Modify the `"build"` section in `package.json`:
- `appId` - Unique application identifier
- `publisherName` - Publisher name (Windows only)
- `category` - App category for app stores

## Troubleshooting

### Common Issues

#### "electron not found"
**Solution**: Install Electron dependencies
```cmd
npm install --save-dev electron electron-builder cross-env
```

#### "Module not found" errors
**Solution**: Ensure all dependencies are installed
```cmd
npm install
cd backend && npm install && cd ..
```

#### "NSIS error"
**Solution**: Windows Defender or antivirus may be blocking. Add project folder to exclusions.

#### Large file size
**Solution**: The first build downloads Electron binaries (~100MB). Subsequent builds reuse cached files.

### Build Requirements
- **Node.js** 16+ (recommended: latest LTS)
- **npm** 7+
- **Windows**: Visual Studio Build Tools or Visual Studio Community
- **Disk Space**: ~500MB free space for dependencies and build output

## Advanced Configuration

### Cross-Platform Building
To build for multiple platforms, modify the target in `package.json`:

```json
{
  "build": {
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ]
    },
    "mac": {
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] }
      ]
    },
    "linux": {
      "target": [
        { "target": "AppImage", "arch": ["x64"] },
        { "target": "deb", "arch": ["x64"] }
      ]
    }
  }
}
```

### Auto-Updates
The build includes auto-update configuration. To enable:
1. Set up a release server
2. Configure `publish` in electron-builder config
3. Implement update checks in the app

### Code Signing (Production)
For distribution, add code signing certificates:
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "password"
    }
  }
}
```

## Performance Tips

1. **Incremental Builds**: Only frontend/backend changes require full rebuilds
2. **Dependency Caching**: npm and Electron binaries are cached between builds
3. **Exclude Files**: Use `files` array in build config to exclude unnecessary files
4. **Compression**: electron-builder automatically compresses the final package

## Distribution

### Portable Version
- No installation required
- Can run from USB drive
- User data stored in app directory

### Installer Version
- Installs to Program Files
- Creates desktop shortcuts
- Registers file associations
- User data in AppData folder

The batch file builds both versions automatically for maximum compatibility.