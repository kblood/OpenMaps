# Build OpenMaps Desktop App
# This script builds the desktop application

Write-Host ""
Write-Host "Building OpenMaps Desktop App" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$env:NODE_ENV = 'production'
Set-Location "C:\LLM\Github_CoPilot_CLI\OpenMaps_test"

try {
    Write-Host "[1/3] Building frontend..." -ForegroundColor Yellow
    npx vite build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Write-Host "    Done!" -ForegroundColor Green
    
    Write-Host "[2/3] Building backend..." -ForegroundColor Yellow
    Set-Location backend
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
    Set-Location ..
    Write-Host "    Done!" -ForegroundColor Green
    
    Write-Host "[3/3] Building Electron app (2-5 minutes)..." -ForegroundColor Yellow
    npx electron-builder --win
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "    Warning: Electron build had errors, checking output..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Checking for output..." -ForegroundColor Yellow
    
    $exePath = ".\release\OpenMaps-Desktop-v1.0.0\win-unpacked\OpenMaps.exe"
    if (Test-Path $exePath) {
        $size = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
        Write-Host ""
        Write-Host "SUCCESS!" -ForegroundColor Green
        Write-Host "App: $exePath" -ForegroundColor White
        Write-Host "Size: $size MB" -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host "Warning: .exe not found at expected location" -ForegroundColor Yellow
    }
}
catch {
    Write-Host ""
    Write-Host "BUILD FAILED: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
