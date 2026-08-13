@echo off
chcp 65001 >nul
title MediaFetch

echo.
echo  =======================================
echo           MediaFetch v1.0.0
echo  =======================================
echo.

cd /d "%~dp0"

:: yt-dlp kontrolü
if not exist "bin\yt-dlp.exe" (
    echo  yt-dlp bulunamadı. Kurulum başlatılıyor...
    echo.
    node setup.js
    echo.
)

:: npm paketleri kontrolü
if not exist "node_modules" (
    echo  Gerekli paketler yükleniyor...
    npm install --silent
    echo.
)

echo  Program başlatılıyor...
echo  Tarayıcıda açılacak: http://localhost:3434
echo.
echo  Kapatmak için bu pencereyi kapatın.
echo.

node server.js
pause
