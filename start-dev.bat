@echo off
REM OpenMaps Development Server Startup Script
REM Starts both backend (port 3001) and frontend (port 5173)

echo.
echo ========================================
echo   OpenMaps Development Server
echo ========================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting servers...
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo ========================================
echo.

REM Start backend in a new window
start "OpenMaps Backend" cmd /k "cd /d %~dp0backend && npm run dev"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "OpenMaps Frontend" cmd /k "cd /d %~dp0 && npm run dev"

REM Wait a moment then open browser
timeout /t 5 /nobreak >nul

echo.
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo Servers are running in separate windows.
echo Close those windows to stop the servers.
echo ========================================
echo.
pause
