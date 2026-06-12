@echo off
setlocal

set "ROOT=%~dp0"
set "FRONT_URL=http://localhost:5173/"

echo.
echo ========================================
echo AirNote Local Gesture Test
echo ========================================
echo Database: Not used
echo Backend:  Not used
echo Frontend: %FRONT_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient('127.0.0.1', 5173); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  start "AirNote Gesture Frontend" "%ROOT%run_frontend.bat"
  timeout /t 3 /nobreak >nul
) else (
  echo [OK] Frontend is already running on port 5173.
)

start "" "%FRONT_URL%"

echo.
echo Click "DB 없이 웹캠 제스처 테스트" on the login screen.
echo Allow camera and microphone access in the browser.
echo.
pause
endlocal
