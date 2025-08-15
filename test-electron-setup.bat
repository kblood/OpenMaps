@echo off
echo Testing OpenMaps Electron Setup...
echo.

REM Test 1: Check if package.json exists
if exist "package.json" (
    echo ✓ package.json found
) else (
    echo ✗ package.json not found
    exit /b 1
)

REM Test 2: Check if main entry point is correct
findstr "main.*electron/main.js" package.json >nul
if %errorlevel% == 0 (
    echo ✓ Electron main entry point configured correctly
) else (
    echo ✗ Electron main entry point not found in package.json
)

REM Test 3: Check if electron folder exists
if exist "electron" (
    echo ✓ Electron folder exists
) else (
    echo ✗ Electron folder not found
)

REM Test 4: Check if main.js exists
if exist "electron\main.js" (
    echo ✓ Electron main.js found
) else (
    echo ✗ Electron main.js not found
)

REM Test 5: Check if preload.js exists
if exist "electron\preload.js" (
    echo ✓ Electron preload.js found
) else (
    echo ✗ Electron preload.js not found
)

REM Test 6: Check build configuration
findstr "electron-builder" package.json >nul
if %errorlevel% == 0 (
    echo ✓ electron-builder configuration found
) else (
    echo ✗ electron-builder configuration not found
)

REM Test 7: Check if icons directory exists
if exist "public\icons" (
    echo ✓ Icons directory exists
) else (
    echo ! Icons directory missing - will be created during build
)

echo.
echo Setup validation complete!
echo Ready to run build-electron-desktop.bat
pause