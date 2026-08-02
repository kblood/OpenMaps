# 🚀 Quick Build Commands - Copy & Paste

## If PowerShell script doesn't work, use these commands:

### Method 1: Standard Desktop App (Easiest)
```powershell
# Navigate to project
cd C:\LLM\Github_CoPilot_CLI\OpenMaps_test

# Set environment
$env:NODE_ENV='production'

# Build frontend
npm run build

# Build backend
cd backend
npm run build
cd ..

# Build desktop app
npm run build:electron-win

# Find your app in:
# release/OpenMaps-Desktop-v1.0.0/OpenMaps-Portable-1.0.0.exe
```

---

### Method 2: Secure Desktop App (Limited Network)

```powershell
# Navigate to project
cd C:\LLM\Github_CoPilot_CLI\OpenMaps_test

# Set environment
$env:NODE_ENV='production'

# Copy secure main file
Copy-Item electron\main-secure.js electron\main.js -Force

# Build frontend
npm run build

# Build backend  
cd backend
npm run build
cd ..

# Build desktop app
npm run build:electron-win
```

---

### Method 3: Full Offline Desktop App (No Web Access)

```powershell
# Navigate to project
cd C:\LLM\Github_CoPilot_CLI\OpenMaps_test

# Set environment
$env:NODE_ENV='production'

# Enable full offline mode
$content = Get-Content electron\main-secure.js -Raw
$content = $content -replace 'const OFFLINE_MODE = false;', 'const OFFLINE_MODE = true;'
Set-Content electron\main-secure.js -Value $content

# Copy secure main file
Copy-Item electron\main-secure.js electron\main.js -Force

# Build frontend
npm run build

# Build backend
cd backend
npm run build
cd ..

# Build desktop app
npm run build:electron-win
```

---

## 🧪 Test Offline in Browser (30 seconds - No Build Needed!)

**Fastest way to test offline functionality:**

```powershell
# Make sure servers are running:
# Terminal 1: cd backend && npm run dev
# Terminal 2: npm run dev

# Then:
1. Open http://localhost:3000 in Chrome
2. Press F12 to open DevTools
3. Go to Network tab
4. Check the "Offline" checkbox
5. Try navigating the map to Aalborg (57.05°N, 9.92°E)
```

**Expected Result:**
- ✅ Map tiles load from IndexedDB cache
- ✅ No network requests in Network tab
- ✅ Smooth navigation
- ✅ Offline routing works (mathematical fallback)

---

## 🛠️ Alternative: Use Simple Build Script

```powershell
cd C:\LLM\Github_CoPilot_CLI\OpenMaps_test
.\build-simple.ps1
```

Or the secure script (fixed):
```powershell
.\build-secure.ps1
# or
.\build-secure.ps1 -FullOffline
```

---

## 📦 Where to Find Your App

After build completes:
```
C:\LLM\Github_CoPilot_CLI\OpenMaps_test\release\OpenMaps-Desktop-v1.0.0\

Files:
├── OpenMaps-Portable-1.0.0.exe    ← Run this (Portable)
└── OpenMaps-1.0.0-x64.exe         ← Or this (Installer)
```

---

## ⚡ Quick Test Commands

### Test Backend API
```powershell
curl http://localhost:3001/health
curl "http://localhost:3001/api/geocoding/search?q=Aalborg"
```

### Run Automated Tests
```powershell
node test-aalborg.js
```

### Check if Servers Running
```powershell
# Backend should be on port 3001
netstat -ano | findstr :3001

# Frontend should be on port 3000
netstat -ano | findstr :3000
```

---

## 🐛 Troubleshooting

### Build fails with "command not found"
**Solution:** Make sure you ran `npm install` first
```powershell
npm install
cd backend && npm install && cd ..
```

### "NODE_ENV" issue
**Solution:** Always set it before building
```powershell
$env:NODE_ENV='production'  # For building
$env:NODE_ENV='development' # For development/npm install
```

### Electron build is slow
**Normal!** Takes 2-5 minutes. Just wait.

### Backend doesn't start in app
**Check:** Make sure backend/dist/server.js exists
```powershell
Test-Path backend\dist\server.js
```

---

## 💡 Pro Tips

1. **Test in browser first** - It's faster and easier
2. **Build simple app first** - Make sure it works before trying secure version
3. **Download Aalborg pack** - Do this while online before testing offline
4. **Use DevTools** - Check console and network tabs for errors
5. **Check disk space** - Electron build needs ~500MB free

---

## 🎯 Recommended Workflow

```
1. Test servers working → npm run dev (both terminals)
2. Test in browser offline → F12 → Network → Offline
3. Download Aalborg pack → Use Map Pack Manager
4. Build desktop app → .\build-simple.ps1
5. Test desktop app → Run .exe, test offline
```

---

**Start with browser offline testing - it's instant!** 🚀
