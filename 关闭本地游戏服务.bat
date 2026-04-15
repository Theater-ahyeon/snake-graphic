@echo off
setlocal

set "WINDOW_TITLE=Neon Snake Preview Server"

echo Trying to stop the local game server...
taskkill /FI "WINDOWTITLE eq %WINDOW_TITLE%" /T /F >nul 2>nul

if errorlevel 1 (
  echo No running local game server window was found.
) else (
  echo Local game server closed.
)

timeout /t 2 /nobreak >nul
exit /b 0
