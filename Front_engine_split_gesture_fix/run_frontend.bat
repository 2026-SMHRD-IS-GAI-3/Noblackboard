@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%node_modules" (
  echo [ERROR] node_modules was not found.
  echo Run setup.bat first.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient('127.0.0.1', 5173); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [OK] AirNote frontend is already running:
  echo http://localhost:5173/
  echo.
  exit /b 0
)

cd /d "%ROOT%"
call npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort

endlocal
