@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\desktop-tools.ps1" -Action run
if errorlevel 1 (
  echo.
  echo [Neon Snake Studio] 桌面版启动失败。
  pause
  exit /b 1
)
