# OpenMaps Build & Installation Guide

## Overview
We've created multiple professional build and installation options for OpenMaps, ranging from simple portable versions to full professional installers. Here's a complete guide to all available options.

## Build Scripts Available

### 1. Basic Builds

#### `build-electron.bat` (Original Working)
- **Type**: Simple portable build
- **Requirements**: Node.js, npm
- **Output**: `release\OpenMaps\OpenMaps.exe`
- **Features**: Basic Electron app, works immediately
- **Use Case**: Quick development builds, testing

#### `build-enhanced.bat`
- **Type**: Enhanced portable build with professional features
- **Requirements**: Node.js, npm
- **Output**: `release\OpenMaps-Enhanced-v1.0.0\`
- **Features**: Professional icon, documentation, launcher script
- **Use Case**: Better portable distribution

### 2. Professional Installers

#### `build-installer-professional.bat`
- **Type**: Professional Windows installer
- **Requirements**: NSIS or Inno Setup installed
- **Output**: `OpenMaps-Setup-v1.0.0.exe` + portable ZIP
- **Features**: 
  - NSIS or Inno Setup installer
  - Start Menu integration
  - Desktop shortcuts
  - Add/Remove Programs entry
  - Professional uninstaller
- **Use Case**: Enterprise deployment, wide distribution

#### `build-self-extracting-installer.bat` (Recommended)
- **Type**: Self-extracting installer (no external tools required)
- **Requirements**: Only Windows PowerShell (built-in)
- **Output**: `OpenMaps-SelfExtractingInstaller-v1.0.0.zip`
- **Features**:
  - No NSIS/Inno Setup required
  - Automatic elevation for admin rights
  - Customizable installation directory
  - Desktop and Start Menu shortcuts
  - Add/Remove Programs integration
  - Built-in uninstaller
  - Works on any Windows 10+ machine
- **Use Case**: **Best for general distribution** - no dependencies

### 3. Development Builds

#### `build-professional.bat`
- **Type**: Multi-option build system
- **Requirements**: Node.js, npm, optionally electron-builder
- **Features**: Interactive menu with multiple build types
- **Use Case**: Development workflow with multiple options

## Installation Options for Users

### Option 1: Self-Extracting Installer (Recommended)
1. Download `OpenMaps-SelfExtractingInstaller-v1.0.0.zip`
2. Extract the ZIP file
3. Run `Install.bat` (will request admin rights if needed)
4. Follow the prompts
5. Enjoy OpenMaps!

**Benefits:**
- No additional software needed
- Professional installation experience
- Automatic elevation handling
- Works on any Windows machine

### Option 2: Professional Installer (Advanced)
1. Download `OpenMaps-Setup-v1.0.0.exe`
2. Run the installer (requires NSIS/Inno Setup to build)
3. Follow installation wizard
4. Complete professional installation

**Benefits:**
- Traditional Windows installer experience
- Most professional looking
- Enterprise-ready

### Option 3: Portable Version
1. Download `OpenMaps-Portable-v1.0.0.zip`
2. Extract anywhere
3. Run `OpenMaps.exe` directly
4. No installation required

**Benefits:**
- No installation needed
- Can run from USB drive
- No admin rights required
- Completely portable

## Build Comparison

| Build Type | Size | Requirements | Admin Rights | Professional | Distribution Ready |
|------------|------|--------------|--------------|-------------|-------------------|
| Basic Portable | ~150MB | Node.js | No | ⭐⭐ | ⭐⭐ |
| Enhanced Portable | ~150MB | Node.js | No | ⭐⭐⭐ | ⭐⭐⭐ |
| Professional Installer | ~150MB | NSIS/Inno Setup | Yes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Self-Extracting | ~150MB | None | Auto-handled | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## Recommended Workflow

### For Developers:
1. Use `build-electron.bat` for quick testing
2. Use `build-self-extracting-installer.bat` for distribution

### For Distribution:
1. **Primary**: Use the self-extracting installer - best balance of features and compatibility
2. **Alternative**: Use professional installer if you have NSIS/Inno Setup
3. **Backup**: Always provide portable ZIP for users who prefer it

## Technical Features

### All Builds Include:
- ✅ Interactive maps with multiple tile layers
- ✅ Address search and geocoding
- ✅ GPS location support
- ✅ Routing and directions
- ✅ Local storage and settings persistence
- ✅ Offline-capable (with cached tiles)
- ✅ Professional app icon
- ✅ Windows registry integration

### Installer-Specific Features:
- ✅ Start Menu shortcuts
- ✅ Desktop shortcuts (optional)
- ✅ Add/Remove Programs entry
- ✅ Clean uninstaller
- ✅ Custom installation directory
- ✅ Administrator rights handling
- ✅ Registry cleanup on uninstall

## Troubleshooting

### Common Build Issues:
1. **TypeScript errors**: Fix source code issues first
2. **PowerShell execution policy**: Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. **Electron-builder fails**: Use the self-extracting installer instead
4. **Missing dependencies**: Run `npm install` first

### Common Installation Issues:
1. **Permission denied**: Run installer as Administrator
2. **PowerShell script blocked**: Check execution policy
3. **Antivirus blocking**: Add to exclusions temporarily
4. **Disk space**: Ensure 500MB+ free space

## Support

For build issues or installation problems:
- Check the logs output during build
- Ensure all prerequisites are installed
- Try the self-extracting installer as it has the fewest dependencies
- Report issues at: https://github.com/openmaps/openmaps/issues

## Summary

The **self-extracting installer** (`build-self-extracting-installer.bat`) is the recommended approach because:
- ✅ No external tools required (NSIS/Inno Setup)
- ✅ Professional installation experience
- ✅ Automatic elevation handling
- ✅ Works on any Windows 10+ machine
- ✅ Easy to distribute (single ZIP file)
- ✅ Full feature set (shortcuts, uninstaller, registry)

This provides the best balance of professionalism, compatibility, and ease of distribution.
