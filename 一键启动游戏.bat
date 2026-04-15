@echo off
setlocal

cd /d "%~dp0"
title Neon Snake Studio Launcher

set "PORT=4173"
set "URL=http://127.0.0.1:%PORT%"
set "SERVER_WINDOW_TITLE=Neon Snake Preview Server"

echo.
echo ==========================================
echo        Neon Snake Studio Launcher
echo ==========================================
echo.

set "PNPM_CMD="

if exist "%APPDATA%\npm\pnpm.cmd" (
  set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"
) else (
  where pnpm.cmd >nul 2>nul
  if not errorlevel 1 set "PNPM_CMD=pnpm.cmd"
)

if not defined PNPM_CMD (
  where corepack.cmd >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Neither pnpm nor corepack was found.
    echo Please install Node.js first.
    pause
    exit /b 1
  )
  set "PNPM_CMD=corepack pnpm"
)

if not exist "node_modules" (
  echo [1/4] Installing dependencies...
  call %PNPM_CMD% install
  if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Dependencies already exist. Skip install.
)

echo [2/4] Building latest game version...
call %PNPM_CMD% build
if errorlevel 1 (
  if not exist "dist\index.html" (
    echo [ERROR] Build failed and no existing dist version was found.
    pause
    exit /b 1
  )
  echo [WARN] Build failed, but an existing dist version was found.
  echo [WARN] The launcher will continue with the last built version.
)

echo [3/4] Starting local preview server...
start "%SERVER_WINDOW_TITLE%" powershell -NoExit -ExecutionPolicy Bypass -File "%cd%\scripts\serve-dist.ps1" -Port %PORT% -RootDir "%cd%\dist"

echo [4/4] Opening browser...
timeout /t 3 /nobreak >nul
start "" "%URL%"

echo.
echo Game started: %URL%
echo To stop the local server, double click "Close Local Game Server.bat"
echo.
exit /b 0
