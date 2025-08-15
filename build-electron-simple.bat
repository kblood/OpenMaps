@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  OpenMaps Electron Desktop Builder
echo ========================================
echo.

echo [1/8] Checking prerequisites...

REM Test Node.js without output redirection first
echo Testing Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Testing npm...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo ✓ Node.js and npm are installed
echo.

echo [2/8] Installing dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo ✓ Frontend dependencies already installed
)

echo [3/8] Installing Electron dependencies...
call npm list electron 2>nul | find "electron@" >nul
if %errorlevel% neq 0 (
    echo Installing Electron and build tools...
    call npm install --save-dev electron@^22.0.0 electron-builder@^24.0.0 cross-env@^7.0.3
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Electron dependencies
        pause
        exit /b 1
    )
) else (
    echo ✓ Electron already installed
)

echo.
echo Prerequisites check completed successfully!
echo Ready to build. Continue? (Press any key)
pause

echo [4/8] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)

echo [5/8] Building backend...
call npm run build:backend
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed
    pause
    exit /b 1
)

echo [6/8] Building Electron app...
call npm run build:electron-win
if %errorlevel% neq 0 (
    echo ERROR: Electron build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Output: release/OpenMaps-Desktop-v1.0.0/
pause