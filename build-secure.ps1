#!/usr/bin/env pwsh
# Build Secure OpenMaps Desktop App
# Usage: .\build-secure.ps1 [-FullOffline] [-SkipBackend]

param(
    [switch]$FullOffline,
    [switch]$SkipBackend,
    [switch]$Help
)

if ($Help) {
    Write-Host "Build Secure OpenMaps Desktop App"
    Write-Host ""
    Write-Host "Usage: .\build-secure.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -FullOffline    Build with full offline mode"
    Write-Host "  -SkipBackend    Skip backend rebuild"
    Write-Host "  -Help           Show this help"
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "Building Secure OpenMaps Desktop App" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$originalLocation = Get-Location

try {
    # Set environment
    $env:NODE_ENV = 'production'
    
    # Use current directory (where script is located)
    $projectPath = $PSScriptRoot
    if (-not $projectPath) {
        $projectPath = Get-Location
    }
    Write-Host "Project: $projectPath" -ForegroundColor Yellow
    Set-Location $projectPath
    
    # Update offline mode if requested
    if ($FullOffline) {
        Write-Host "Enabling FULL OFFLINE MODE..." -ForegroundColor Yellow
        $mainSecurePath = "electron\main-secure.js"
        $mainSecure = Get-Content $mainSecurePath -Raw
        $mainSecure = $mainSecure -replace 'const OFFLINE_MODE = false;', 'const OFFLINE_MODE = true;'
        Set-Content $mainSecurePath -Value $mainSecure
        Write-Host "  Full offline mode enabled" -ForegroundColor Green
    }
    else {
        Write-Host "Using LIMITED NETWORK mode" -ForegroundColor Yellow
        Write-Host "  Filtered domain access enabled" -ForegroundColor Green
    }
    
    # Copy secure main file
    Write-Host "Installing secure main file..." -ForegroundColor Yellow
    Copy-Item "electron\main-secure.js" "electron\main.js" -Force
    Write-Host "  Secure main file installed" -ForegroundColor Green
    
    # Build frontend
    Write-Host "Building frontend..." -ForegroundColor Yellow
    $null = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed"
    }
    Write-Host "  Frontend built" -ForegroundColor Green
    
    # Build backend
    if (-not $SkipBackend) {
        Write-Host "Building backend..." -ForegroundColor Yellow
        Set-Location "backend"
        $null = npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Backend build failed"
        }
        Set-Location ".."
        Write-Host "  Backend built" -ForegroundColor Green
    }
    
    # Build Electron app
    Write-Host "Building Electron app (this takes 2-5 minutes)..." -ForegroundColor Yellow
    Write-Host "  Please wait..." -ForegroundColor Gray
    $null = npm run build:electron-win 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Electron build failed"
    }
    Write-Host "  Desktop app built" -ForegroundColor Green
    
    # Show output
    Write-Host ""
    Write-Host "Build Complete!" -ForegroundColor Green
    Write-Host "===============" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Output Location:" -ForegroundColor Yellow
    $releaseDir = Get-ChildItem "release" -Directory -ErrorAction SilentlyContinue |
                  Sort-Object LastWriteTime -Descending |
                  Select-Object -First 1
    
    if ($releaseDir) {
        $portableApp = Get-ChildItem -Path $releaseDir.FullName -Filter "*Portable*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($portableApp) {
            Write-Host "  Portable App: $($portableApp.FullName)" -ForegroundColor White
            Write-Host "  Size: $([math]::Round($portableApp.Length / 1MB, 2)) MB" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "Security Configuration:" -ForegroundColor Cyan
    if ($FullOffline) {
        Write-Host "  Full Offline Mode: ENABLED" -ForegroundColor Green
        Write-Host "  Only localhost connections" -ForegroundColor Green
    }
    else {
        Write-Host "  Limited Network Mode: ENABLED" -ForegroundColor Green
        Write-Host "  Filtered domain access" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host ""
    
}
catch {
    Write-Host ""
    Write-Host "Build Failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
finally {
    Set-Location $originalLocation
}
