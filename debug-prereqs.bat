@echo off
echo Testing prerequisites...
echo.

echo Testing Node.js...
node --version
echo Node.js exit code: %errorlevel%
echo.

echo Testing npm...
npm --version
echo npm exit code: %errorlevel%
echo.

echo Testing if node is recognized...
where node
echo.

echo Testing if npm is recognized...
where npm
echo.

echo Current PATH:
echo %PATH%
echo.

pause