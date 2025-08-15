@echo off
setlocal enabledelayedexpansion

echo Testing each step...
echo.

echo Step 1: Node.js check
node --version
echo Node.js errorlevel: %errorlevel%
echo.

echo Step 2: npm check  
npm --version
echo npm errorlevel: %errorlevel%
echo.

echo Step 3: Continue after checks
echo This line should appear if checks pass
echo.

echo Step 4: Test errorlevel logic
node --version >nul 2>&1
echo Errorlevel after silent node check: %errorlevel%
if %errorlevel% neq 0 (
    echo This would cause exit
) else (
    echo This would continue
)
echo.

echo Step 5: Test npm errorlevel logic
npm --version >nul 2>&1
echo Errorlevel after silent npm check: %errorlevel%
if %errorlevel% neq 0 (
    echo This would cause exit
) else (
    echo This would continue
)
echo.

echo All tests completed!
pause