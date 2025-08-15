@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  OpenMaps Electron Desktop Builder
echo ========================================
echo.

REM Get current timestamp
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

echo [1/8] Checking prerequisites...
echo Checking Node.js installation...
node --version
echo Checking npm installation...
npm --version
echo ✓ Node.js and npm are available
echo.

echo [2/8] Installing dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    echo This may take a few minutes...
    npm install
) else (
    echo ✓ Frontend dependencies already installed
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    npm install --production
    cd ..
) else (
    echo ✓ Backend dependencies already installed
)
echo.

echo [3/8] Installing Electron build tools...
echo Checking if Electron is installed...
npm list electron 2>nul | find "electron@" >nul
if not errorlevel 1 (
    echo ✓ Electron already installed
) else (
    echo Installing Electron and build tools...
    echo This downloads ~100MB - please wait...
    npm install --save-dev electron@^22.0.0 electron-builder@^24.0.0 cross-env@^7.0.3
)
echo.

echo [4/8] Cleaning previous builds...
if exist "dist" rmdir /s /q "dist" 2>nul
if exist "backend\dist" rmdir /s /q "backend\dist" 2>nul
if exist "release" rmdir /s /q "release" 2>nul
echo ✓ Clean completed
echo.

echo [5/8] Building frontend application...
echo Running: npm run build
npm run build
echo ✓ Frontend build completed
echo.

echo [6/8] Building backend application...
echo Running: npm run build:backend
npm run build:backend
echo ✓ Backend build completed
echo.

echo [7/8] Preparing app resources...
if not exist "public\icons" (
    mkdir "public\icons" 2>nul
    echo Created icons directory
)
echo ✓ Resources prepared
echo.

echo [8/8] Building Electron desktop application...
echo This may take 3-5 minutes...
echo.
npm run build:electron-win
echo.

echo ========================================
echo  🎉 BUILD COMPLETED SUCCESSFULLY! 🎉
echo ========================================
echo.

set "RELEASE_DIR=release\OpenMaps-Desktop-v%VERSION%"
if exist "%RELEASE_DIR%" (
    echo 📁 Built application location: %RELEASE_DIR%
    echo.
    echo 📦 Built files:
    dir "%RELEASE_DIR%\*.exe" /b 2>nul
    echo.
    echo 🚀 Ready to use!
    echo.
    set /p "OPEN_FOLDER=Open the release folder? (y/n): "
    if /i "!OPEN_FOLDER!"=="y" start "" "%RELEASE_DIR%"
) else (
    echo Check the 'release' folder for built files.
)

echo.
echo Build completed at: %BUILD_TIME%
echo Thank you for building OpenMaps Desktop!
echo.
pause