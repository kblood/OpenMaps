@echo off
setlocal enabledelayedexpansion

REM ====================================================================
REM  OpenMaps Electron Desktop Build Script for Windows
REM  This script builds a complete Electron desktop application
REM ====================================================================

echo.
echo ========================================
echo  OpenMaps Electron Desktop Builder
echo ========================================
echo.

REM Get current date and time for build info
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "MIN=%dt:~10,2%" & set "SS=%dt:~12,2%"
set "BUILD_TIME=%YYYY%-%MM%-%DD%_%HH%-%MIN%-%SS%"

REM Read version from package.json
for /f "tokens=2 delims=:, " %%i in ('findstr "version" package.json') do (
    set "VERSION=%%i"
    set "VERSION=!VERSION:"=!"
    goto :version_found
)
:version_found

echo Build Time: %BUILD_TIME%
echo App Version: %VERSION%
echo.

REM Check if Node.js is installed
echo [1/8] Checking prerequisites...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo ✓ Node.js and npm are installed
echo.

REM Install dependencies if node_modules doesn't exist
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

REM Install backend dependencies
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install --production
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install backend dependencies
        cd ..
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
    call npm install --save-dev electron@^22.0.0 electron-builder@^24.0.0 cross-env@^7.0.3
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Electron dependencies
        pause
        exit /b 1
    )
) else (
    echo ✓ Electron build tools already installed
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
echo Running: npm run build
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
echo ✓ Frontend build completed
echo.

REM Build backend
echo [6/8] Building backend application...
echo Running: npm run build:backend
call npm run build:backend
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed
    pause
    exit /b 1
)
echo ✓ Backend build completed
echo.

REM Create app icons directory if it doesn't exist
echo [7/8] Preparing app resources...
if not exist "public\icons" (
    echo Creating icons directory...
    mkdir "public\icons"
    echo NOTE: Please add icon files to public\icons\ directory for better branding
)
echo ✓ Resources prepared
echo.

REM Build Electron application
echo [8/8] Building Electron desktop application...
echo This may take several minutes...
echo.
call npm run build:electron-win
if %errorlevel% neq 0 (
    echo ERROR: Electron build failed
    echo.
    echo Common solutions:
    echo 1. Ensure you have a stable internet connection for downloading Electron binaries
    echo 2. Try running the command again - sometimes downloads timeout
    echo 3. Check that you have sufficient disk space
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.

REM Find the built application
set "RELEASE_DIR=release\OpenMaps-Desktop-v%VERSION%"
if exist "%RELEASE_DIR%" (
    echo Built application location: %RELEASE_DIR%
    echo.
    
    REM List built files
    echo Built files:
    for %%f in ("%RELEASE_DIR%\*") do (
        echo   %%~nxf
    )
    
    echo.
    echo Installation files:
    echo   - OpenMaps Setup %VERSION%.exe (Installer)
    echo   - OpenMaps %VERSION%.exe (Portable version)
    echo.
    echo The portable version can be run directly without installation.
    echo The setup version will install OpenMaps to your system.
    echo.
    
    REM Ask if user wants to open the release folder
    set /p "OPEN_FOLDER=Open the release folder? (y/n): "
    if /i "!OPEN_FOLDER!"=="y" (
        start "" "%RELEASE_DIR%"
    )
    
) else (
    echo Warning: Could not find expected release directory: %RELEASE_DIR%
    echo Check the 'release' folder for built files.
)

echo.
echo Build completed at: %BUILD_TIME%
echo App version: %VERSION%
echo.
echo Thank you for building OpenMaps Desktop!
echo.

pause