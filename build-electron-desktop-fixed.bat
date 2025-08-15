@echo off
setlocal enabledelayedexpansion

REM ====================================================================
REM  OpenMaps Electron Desktop Build Script for Windows (Fixed Version)
REM  This script builds a complete Electron desktop application
REM ====================================================================

echo.
echo ========================================
echo  OpenMaps Electron Desktop Builder
echo ========================================
echo.

REM Get current timestamp (simple method)
set "BUILD_TIME=%date:~-4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "BUILD_TIME=%BUILD_TIME: =0%"

REM Read version from package.json
set "VERSION=1.0.0"
for /f "tokens=2 delims=:, " %%i in ('findstr "version" package.json 2^>nul') do (
    set "VERSION=%%i"
    set "VERSION=!VERSION:"=!"
    goto :version_found
)
:version_found

echo Build Time: %BUILD_TIME%
echo App Version: %VERSION%
echo Target: Windows x64 Desktop Application
echo Output: release/OpenMaps-Desktop-v%VERSION%/
echo.

REM Check if Node.js is installed
echo [1/8] Checking prerequisites...
echo Checking Node.js installation...
node --version 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Recommended version: 18.x LTS or newer
    echo.
    pause
    exit /b 1
)

REM Check if npm is installed
echo Checking npm installation...
npm --version 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm is not installed or not in PATH
    echo This usually comes with Node.js installation
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js and npm are installed
for /f %%i in ('node --version') do echo   Node.js: %%i
for /f %%i in ('npm --version') do echo   npm: %%i
echo.

REM Install dependencies if node_modules doesn't exist
echo [2/8] Installing dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    echo This may take a few minutes on first run...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install frontend dependencies
        echo Try running: npm install
        echo.
        pause
        exit /b 1
    )
) else (
    echo ✓ Frontend dependencies already installed
)

REM Check backend directory
if not exist "backend" (
    echo.
    echo ERROR: Backend directory not found
    echo Please ensure you're running this from the OpenMaps root directory
    echo.
    pause
    exit /b 1
)

REM Install backend dependencies
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install --production
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install backend dependencies
        echo Try running: cd backend && npm install
        cd ..
        echo.
        pause
        exit /b 1
    )
    cd ..
) else (
    echo ✓ Backend dependencies already installed
)

echo.

REM Install Electron dependencies if needed
echo [3/8] Installing Electron build tools...
call npm list electron >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Electron and build tools...
    echo This downloads ~100MB on first run - please be patient...
    call npm install --save-dev electron@^22.0.0 electron-builder@^24.0.0 cross-env@^7.0.3
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install Electron dependencies
        echo.
        echo Common causes:
        echo 1. Network connection issues
        echo 2. Firewall blocking downloads
        echo 3. Insufficient disk space
        echo.
        echo Try running: npm install --save-dev electron electron-builder cross-env
        echo.
        pause
        exit /b 1
    )
) else (
    echo ✓ Electron build tools already installed
    for /f %%i in ('npm list electron --depth=0 2^>nul ^| findstr electron@') do echo   %%i
)
echo.

REM Clean previous builds
echo [4/8] Cleaning previous builds...
if exist "dist" (
    echo Cleaning frontend dist folder...
    rmdir /s /q "dist" 2>nul
)
if exist "backend\dist" (
    echo Cleaning backend dist folder...
    rmdir /s /q "backend\dist" 2>nul
)
if exist "release" (
    echo Cleaning previous releases...
    rmdir /s /q "release" 2>nul
)
echo ✓ Clean completed
echo.

REM Build frontend
echo [5/8] Building frontend application...
echo Running TypeScript compilation and Vite build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Frontend build failed
    echo.
    echo Common causes:
    echo 1. TypeScript compilation errors
    echo 2. Missing dependencies
    echo 3. Vite configuration issues
    echo.
    echo Check the output above for specific error messages
    echo Try running: npm run build
    echo.
    pause
    exit /b 1
)
echo ✓ Frontend build completed
echo.

REM Build backend
echo [6/8] Building backend application...
echo Running backend TypeScript compilation...
call npm run build:backend
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Backend build failed
    echo.
    echo Try running: npm run build:backend
    echo Or manually: cd backend && npm run build
    echo.
    pause
    exit /b 1
)
echo ✓ Backend build completed
echo.

REM Create app icons directory if it doesn't exist
echo [7/8] Preparing app resources...
if not exist "public\icons" (
    echo Creating icons directory...
    mkdir "public\icons" 2>nul
    echo.
    echo NOTE: For better branding, add these icon files to public\icons\:
    echo   - icon-512.png (512x512 pixels, main app icon)
    echo   - icon-256.png (256x256 pixels)
    echo   - icon-128.png (128x128 pixels)
    echo.
)
echo ✓ Resources prepared
echo.

REM Build Electron application
echo [8/8] Building Electron desktop application...
echo.
echo This creates both installer and portable versions
echo Please wait - this may take 3-5 minutes...
echo.

call npm run build:electron-win
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Electron build failed
    echo.
    echo Common solutions:
    echo 1. Ensure stable internet connection for Electron binary downloads
    echo 2. Check available disk space (need ~500MB free)
    echo 3. Temporarily disable antivirus/Windows Defender
    echo 4. Try running the command again
    echo.
    echo Manual build command: npm run build:electron-win
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  🎉 BUILD COMPLETED SUCCESSFULLY! 🎉
echo ========================================
echo.

REM Find the built application
set "RELEASE_DIR=release\OpenMaps-Desktop-v%VERSION%"
if exist "%RELEASE_DIR%" (
    echo 📁 Built application location: %RELEASE_DIR%
    echo.
    
    REM List built files with sizes
    echo 📦 Built files:
    for %%f in ("%RELEASE_DIR%\*.exe") do (
        set "filesize=0"
        for /f %%s in ('powershell -command "(Get-Item '%RELEASE_DIR%\%%~nxf').Length / 1MB -as [int]"') do set "filesize=%%s"
        echo   • %%~nxf (!filesize! MB)
    )
    
    echo.
    echo 🚀 Installation options:
    echo   📦 OpenMaps Setup %VERSION%.exe - Full installer (recommended)
    echo      • Installs to Program Files
    echo      • Creates desktop shortcuts  
    echo      • Adds to Start Menu
    echo      • Automatic updates support
    echo.
    echo   💼 OpenMaps %VERSION%.exe - Portable version
    echo      • No installation required
    echo      • Run from any location (USB drive, etc.)
    echo      • Self-contained application
    echo.
    
    REM Ask if user wants to open the release folder
    set /p "OPEN_FOLDER=🔍 Open the release folder now? (y/n): "
    if /i "!OPEN_FOLDER!"=="y" (
        echo Opening %RELEASE_DIR%...
        start "" "%RELEASE_DIR%"
    )
    
) else (
    echo.
    echo ⚠️  Warning: Expected release directory not found: %RELEASE_DIR%
    echo.
    if exist "release" (
        echo Available files in release folder:
        dir "release" /b
    ) else (
        echo No release folder found - build may have failed silently
    )
)

echo.
echo ===== BUILD SUMMARY =====
echo 🕒 Build completed at: %BUILD_TIME%
echo 📦 App version: %VERSION%
echo 💻 Platform: Windows x64
echo 📁 Output: %RELEASE_DIR%
echo 🎯 Ready for distribution!
echo.
echo Thank you for building OpenMaps Desktop! 🗺️
echo For support: https://github.com/yourusername/openmaps/issues
echo.

pause