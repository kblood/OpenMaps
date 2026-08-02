# Quick Build Script - Simple Version
# Just builds the standard desktop app

Write-Host ""
Write-Host "Building OpenMaps Desktop App" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're in the right directory
$scriptDir = $PSScriptRoot
if ($scriptDir) {
    Set-Location $scriptDir
}

$env:NODE_ENV = 'production'

try {
    # Build frontend
    Write-Host "[1/3] Building frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Write-Host "      Done!" -ForegroundColor Green
    
    # Build backend
    Write-Host "[2/3] Building backend..." -ForegroundColor Yellow
    Set-Location backend
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
    Set-Location ..
    Write-Host "      Done!" -ForegroundColor Green
    
    # Build Electron
    Write-Host "[3/3] Building Electron app (2-5 minutes)..." -ForegroundColor Yellow
    npm run build:electron-win
    if ($LASTEXITCODE -ne 0) { throw "Electron build failed" }
    Write-Host "      Done!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Find your app in: release/OpenMaps-Desktop-v1.0.0/" -ForegroundColor Cyan
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "BUILD FAILED: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
