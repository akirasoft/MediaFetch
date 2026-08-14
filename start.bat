@echo off
chcp 65001 >nul
title MediaFetch

echo.
echo  =======================================
echo             MediaFetch v1.0.0
echo  =======================================
echo.

cd /d "%~dp0"

if not exist "bin\yt-dlp.exe" (
    echo  Downloading yt-dlp...
    echo.
    node setup.js
    echo.
)

if not exist "node_modules" (
    echo  Installing dependencies...
    npm install --silent
    echo.
)

echo  Starting MediaFetch...
echo  Open browser at: http://localhost:3434
echo.
echo  Press Ctrl+C to stop.
echo.

node server.js
pause