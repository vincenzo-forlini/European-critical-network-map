@echo off
REM Starts the map locally and opens it in your browser.
REM Double-click this file. Leave the window open while you use the map.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed, or not on your PATH.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)
node scripts\serve.mjs
pause
