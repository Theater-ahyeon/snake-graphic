@echo off
setlocal

cd /d "%~dp0"
title Neon Snake Studio Quick Play

set "PORT=4173"
set "URL=http://127.0.0.1:%PORT%"
set "SERVER_WINDOW_TITLE=Neon Snake Preview Server"

if not exist "dist\index.html" (
  echo [ERROR] No built dist version was found.
  echo Please run "??????????bat" first.
  pause
  exit /b 1
)

echo Starting quick play server...
start "%SERVER_WINDOW_TITLE%" powershell -NoExit -ExecutionPolicy Bypass -File "%cd%\scripts\serve-dist.ps1" -Port %PORT% -RootDir "%cd%\dist"

timeout /t 2 /nobreak >nul
start "" "%URL%"

echo Game started: %URL%
exit /b 0
