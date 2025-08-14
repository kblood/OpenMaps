@echo off
setlocal enabledelayedexpansion

REM OpenMaps Setup and Launch Script for Windows
REM This script sets up the entire OpenMaps application and launches it

title OpenMaps Setup and Launch

echo.
echo 🗺️  OpenMaps Setup and Launch Script
echo ==================================
echo.

REM Function to check if a command exists
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION%

REM Parse command line arguments
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="--setup-only" goto :setup_only
if "%1"=="--launch-only" goto :launch_only
if "%1"=="--docker" goto :launch_docker
if "%1"=="--check-deps" goto :check_deps

REM Default: full setup and launch
goto :full_setup

:show_help
echo OpenMaps Setup and Launch Script for Windows
echo.
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --setup-only        Only setup dependencies, don't launch
echo   --launch-only       Only launch (assumes setup is complete)
echo   --docker            Use Docker Compose instead
echo   --check-deps        Only check system dependencies
echo.
echo Examples:
echo   %0                  # Full setup and launch
echo   %0 --setup-only     # Only install dependencies
echo   %0 --launch-only    # Only launch the application
echo   %0 --docker         # Use Docker Compose
goto :end

:check_deps
echo [INFO] Checking system dependencies...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    goto :end
)
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    goto :end
)
echo [SUCCESS] All system dependencies are satisfied
goto :end

:setup_frontend
echo [INFO] Setting up frontend...
if not exist "package.json" (
    echo [ERROR] package.json not found in current directory
    goto :error_exit
)

echo [INFO] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    goto :error_exit
)
echo [SUCCESS] Frontend setup complete
goto :eof

:setup_backend
echo [INFO] Setting up backend...
if not exist "backend" (
    echo [ERROR] Backend directory not found
    goto :error_exit
)

cd backend
if not exist "package.json" (
    echo [ERROR] Backend package.json not found
    goto :error_exit
)

echo [INFO] Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    goto :error_exit
)

REM Setup environment file
if not exist ".env" (
    echo [INFO] Creating backend .env file...
    copy ".env.example" ".env" >nul
    echo [SUCCESS] Created .env file from template
    echo [WARNING] You may want to customize the .env file for your environment
)

echo [INFO] Building backend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build backend
    goto :error_exit
)

cd ..
echo [SUCCESS] Backend setup complete
goto :eof

:check_port
netstat -an | findstr ":%1 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    exit /b 1
) else (
    exit /b 0
)

:launch_application
echo [INFO] Launching OpenMaps application...

REM Check if ports are available
call :check_port 3000
if %errorlevel% equ 1 (
    echo [ERROR] Port 3000 is already in use. Please free it or change the frontend port.
    goto :error_exit
)

call :check_port 3001
if %errorlevel% equ 1 (
    echo [ERROR] Port 3001 is already in use. Please free it or change the backend port.
    goto :error_exit
)

REM Create log directory
if not exist "logs" mkdir logs

echo [INFO] Starting backend server...
cd backend
start /b "" cmd /c "npm run dev > ..\logs\backend.log 2>&1"
cd ..

REM Wait for backend to be ready
echo [INFO] Waiting for backend to start...
timeout /t 5 /nobreak >nul

REM Check if backend is running
curl -s http://localhost:3001/health >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Backend may still be starting up...
)

echo [INFO] Starting frontend server...
start /b "" cmd /c "npm run dev > logs\frontend.log 2>&1"

REM Wait for frontend to be ready
echo [INFO] Waiting for frontend to start...
timeout /t 5 /nobreak >nul

echo [SUCCESS] OpenMaps is now running!
echo.
echo 🗺️  OpenMaps Application URLs:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:3001
echo    Health Check: http://localhost:3001/health
echo.
echo 📋 Logs are available in the logs\ directory
echo    Backend: logs\backend.log
echo    Frontend: logs\frontend.log
echo.
echo [INFO] Opening OpenMaps in your default browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo Press any key to stop the application...
pause >nul

echo [INFO] Stopping OpenMaps...
taskkill /f /im node.exe >nul 2>nul
echo [SUCCESS] OpenMaps stopped successfully
goto :end

:setup_only
call :setup_frontend
call :setup_backend
echo [SUCCESS] Setup complete! Run '%0 --launch-only' to start the application
goto :end

:launch_only
call :launch_application
goto :end

:launch_docker
echo [INFO] Launching OpenMaps with Docker Compose...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed
    goto :error_exit
)

where docker-compose >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed
    goto :error_exit
)

echo [INFO] Building and starting containers...
docker-compose up --build
goto :end

:full_setup
call :setup_frontend
call :setup_backend
call :launch_application
goto :end

:error_exit
echo [ERROR] Setup failed!
pause
exit /b 1

:end
pause
exit /b 0