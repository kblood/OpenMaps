# 🔒 Building Secure Offline Desktop App

## Two Versions Available

### 1. Standard Desktop App (Existing)
- Network access to tile servers and APIs
- Best for normal use
- Build command: `npm run build:electron-win`

### 2. Secure Offline App (New) 🔒
- **Limited network access** - only allowed domains
- **Full offline mode** option - no external connections
- **Privacy-focused** - blocks tracking/analytics
- Build with custom main file

---

## Quick Build - Secure Version

### Step 1: Copy Secure Main File
```powershell
cd C:\LLM\Github_CoPilot_CLI\OpenMaps_test
Copy-Item electron\main-secure.js electron\main.js -Force
```

### Step 2: Build
```powershell
# Build frontend
npm run build

# Build backend
cd backend
npm run build
cd ..

# Build Windows app
npm run build:electron-win
```

### Step 3: Find Your App
```
release/OpenMaps-Desktop-v1.0.0/
├── OpenMaps-Portable-1.0.0.exe    ← Run this! (Portable)
└── OpenMaps-1.0.0-x64.exe         ← Or this (Standard)
```

---

## Configuration Options

### Enable Full Offline Mode

Edit `electron/main-secure.js` line 13:
```javascript
const OFFLINE_MODE = true; // Change to true for full offline
```

**Full Offline Mode:**
- ✅ Only localhost connections allowed
- ✅ All external requests blocked
- ✅ Maximum privacy
- ⚠️ Must download map packs first (while online)
- ⚠️ No live tile updates

### Add More Allowed Domains

Edit `electron/main-secure.js` lines 8-20:
```javascript
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'tile.openstreetmap.org',
  // Add your domains here:
  'your-tile-server.com',
  'your-api.com',
];
```

---

## Testing the Secure Build

### Test Network Filtering
1. **Run the built app**: `release/.../OpenMaps-Portable-1.0.0.exe`
2. **Open DevTools**: `View` → `Toggle DevTools`
3. **Check Console**: You should see:
   ```
   🔒 Network filtering enabled
   📋 Allowed domains: localhost, tile.openstreetmap.org, ...
   🔌 Offline mode: DISABLED (or ENABLED)
   ```
4. **Try blocked request**: App will log:
   ```
   🚫 Blocked request to: https://blocked-domain.com
   ```

### Test Offline Functionality
1. **Download Aalborg pack** (while online)
2. **Disconnect internet** (airplane mode)
3. **Navigate to Aalborg**: Should work!
4. **Check menu**: `File` → `Network Status`

### Test Menu Features
```
File Menu:
├── About OpenMaps              (App info)
├── Network Status              (Shows allowed domains)
├── Toggle Offline Mode         (Instructions)
└── Quit

Storage Menu:
├── Clear Cache                 (Remove all map packs)
└── View Storage Info           (Check usage)
```

---

## Build Script Automation

Save this as `build-secure.ps1`:

```powershell
#!/usr/bin/env pwsh
# Build Secure Desktop App

param(
    [switch]$FullOffline,
    [switch]$SkipBackend
)

Write-Host "🔒 Building Secure OpenMaps Desktop App" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    # Set environment
    $env:NODE_ENV = 'production'
    
    # Navigate to project
    Set-Location "C:\LLM\Github_CoPilot_CLI\OpenMaps_test"
    
    # Update offline mode if requested
    if ($FullOffline) {
        Write-Host "`n🔌 Enabling FULL OFFLINE MODE..." -ForegroundColor Yellow
        $mainSecure = Get-Content "electron\main-secure.js" -Raw
        $mainSecure = $mainSecure -replace 'const OFFLINE_MODE = false;', 'const OFFLINE_MODE = true;'
        Set-Content "electron\main-secure.js" -Value $mainSecure
        Write-Host "✅ Full offline mode enabled" -ForegroundColor Green
    }
    
    # Copy secure main file
    Write-Host "`n📋 Installing secure main file..." -ForegroundColor Yellow
    Copy-Item "electron\main-secure.js" "electron\main.js" -Force
    Write-Host "✅ Secure main file installed" -ForegroundColor Green
    
    # Build frontend
    Write-Host "`n🎨 Building frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Write-Host "✅ Frontend built" -ForegroundColor Green
    
    # Build backend
    if (-not $SkipBackend) {
        Write-Host "`n⚙️  Building backend..." -ForegroundColor Yellow
        Set-Location "backend"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
        Set-Location ".."
        Write-Host "✅ Backend built" -ForegroundColor Green
    }
    
    # Build Electron app
    Write-Host "`n🖥️  Building Electron desktop app..." -ForegroundColor Yellow
    npm run build:electron-win
    if ($LASTEXITCODE -ne 0) { throw "Electron build failed" }
    Write-Host "✅ Desktop app built" -ForegroundColor Green
    
    # Show output
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🎉 Build Complete!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "`n📦 Output location:" -ForegroundColor Yellow
    
    $releaseDir = Get-ChildItem "release" -Directory | Select-Object -First 1
    if ($releaseDir) {
        $appPath = Join-Path $releaseDir.FullName "OpenMaps-Portable-1.0.0.exe"
        if (Test-Path $appPath) {
            Write-Host "   $appPath" -ForegroundColor White
            Write-Host "`n🚀 Run this to start: " -NoNewline -ForegroundColor Yellow
            Write-Host "$appPath" -ForegroundColor White
        }
    }
    
    Write-Host "`n🔒 Security features:" -ForegroundColor Cyan
    if ($FullOffline) {
        Write-Host "   ✅ Full offline mode enabled" -ForegroundColor Green
        Write-Host "   ✅ Only localhost connections" -ForegroundColor Green
        Write-Host "   ✅ All external requests blocked" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Limited network mode" -ForegroundColor Green
        Write-Host "   ✅ Filtered domain access" -ForegroundColor Green
        Write-Host "   ✅ External scripts blocked" -ForegroundColor Green
    }
    
    Write-Host "`n💡 Tip: Download map packs before using offline!" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "`n❌ Build failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Set-Location $originalLocation
}
```

### Use the Build Script:
```powershell
# Standard secure build (limited network)
.\build-secure.ps1

# Full offline build (no external network)
.\build-secure.ps1 -FullOffline

# Skip backend rebuild (faster)
.\build-secure.ps1 -SkipBackend
```

---

## Comparison: Standard vs Secure

| Feature | Standard App | Secure App |
|---------|-------------|------------|
| Tile Servers | ✅ Full access | ✅ Filtered |
| External APIs | ✅ Full access | ⚠️ Allowed list only |
| Tracking Scripts | ⚠️ Not blocked | ✅ Blocked |
| Offline Mode | ✅ Optional | ✅ Built-in |
| Privacy | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| Use Case | Daily use | High security |

---

## Distribution

### Portable Version (Recommended)
```
OpenMaps-Portable-1.0.0.exe
```
- ✅ Single file
- ✅ No installation
- ✅ Run from USB drive
- ✅ Perfect for testing

### Installer Version
```
OpenMaps-1.0.0-x64.exe
```
- ✅ Professional installation
- ✅ Start menu shortcuts
- ✅ Uninstaller included

---

## Troubleshooting

### App doesn't start
**Check:**
1. Backend built: `backend/dist/server.js` exists
2. Frontend built: `dist/index.html` exists
3. Run from command line to see errors

### Tiles not loading
**Solution:**
1. Check network filtering console logs
2. Add tile server to allowed domains
3. Or enable full offline mode

### Backend not starting
**Check:**
1. Port 3001 not in use
2. Backend dependencies installed
3. Look for backend errors in console

---

## Advanced: Custom Network Rules

Edit `electron/main-secure.js` `isAllowedUrl()` function for custom logic:

```javascript
function isAllowedUrl(url) {
  // Allow all localhost
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return true;
  }
  
  // Allow only HTTPS
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    return false;
  }
  
  // Custom domain matching
  const urlObj = new URL(url);
  
  // Allow all .osm domains
  if (urlObj.hostname.endsWith('.openstreetmap.org')) {
    return true;
  }
  
  // Block everything else
  return false;
}
```

---

## Next Steps

1. ✅ Build secure version
2. ✅ Test with DevTools
3. ✅ Download Aalborg pack
4. ✅ Test offline mode
5. ✅ Distribute to users

**Your secure offline maps app is ready! 🎉**
