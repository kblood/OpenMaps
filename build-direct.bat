@echo off

echo ========================================
echo  OpenMaps Electron Desktop Builder
echo ========================================

echo Testing: Can we get past npm version?
call npm --version
echo We got past npm!

echo Installing dependencies...
call npm install

echo Installing Electron tools...
call npm install --save-dev electron electron-builder cross-env

echo Building frontend...
call npm run build

echo Building backend...
call npm run build:backend

echo Building Electron app...
call npm run build:electron-win

echo Done!
pause