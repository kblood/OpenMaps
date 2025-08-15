@echo off
echo ========================================
echo  Manual Electron Build (No Installer)
echo ========================================
echo.

echo [1] Building frontend and backend...
call npm run build
call npm run build:backend
echo.

echo [2] Creating manual Electron app structure...
if exist "release\OpenMaps-Manual" rmdir /s /q "release\OpenMaps-Manual"
mkdir "release\OpenMaps-Manual"

echo [3] Copying Electron binaries...
xcopy "node_modules\electron\dist\*" "release\OpenMaps-Manual\" /s /e /i /y

echo [4] Copying application files...
mkdir "release\OpenMaps-Manual\resources\app"
xcopy "dist\*" "release\OpenMaps-Manual\resources\app\dist\" /s /e /i /y
xcopy "backend\dist\*" "release\OpenMaps-Manual\resources\app\backend\dist\" /s /e /i /y
copy "backend\package.json" "release\OpenMaps-Manual\resources\app\backend\"
xcopy "electron\*" "release\OpenMaps-Manual\resources\app\electron\" /s /e /i /y
copy "package.json" "release\OpenMaps-Manual\resources\app\"

echo [5] Installing backend dependencies in app...
cd "release\OpenMaps-Manual\resources\app\backend"
call npm install --production
cd ..\..\..\..

echo [6] Renaming electron.exe to OpenMaps.exe...
ren "release\OpenMaps-Manual\electron.exe" "OpenMaps.exe"

echo.
echo ========================================
echo  Manual Build Complete!
echo ========================================
echo.
echo Executable: release\OpenMaps-Manual\OpenMaps.exe
echo.
echo You can now run the app directly or zip the folder for distribution.
echo.
pause