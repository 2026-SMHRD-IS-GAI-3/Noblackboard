@echo off
setlocal

set "ROOT=%~dp0"
set "STT_DIR=%ROOT%stt_server"
set "VENV_PY=%STT_DIR%\.venv\Scripts\python.exe"
set "STT_PORT=5000"
set "FRONT_HOME=http://localhost:5173/"
set "FRONT_URL=http://localhost:5173/pages/presentation.html"
set "FRONT_RUNNER=%ROOT%run_frontend.bat"
set "STT_RUNNER=%STT_DIR%\run_stt.bat"
set "AIRNOTE_STT_MODEL_ROOT=%STT_DIR%\models"
set "AIRNOTE_STT_LOCAL_ONLY=1"

echo.
echo ========================================
echo Starting AirNote
echo ========================================
echo STT server: http://localhost:%STT_PORT%
echo Frontend:   %FRONT_HOME%
echo Presentation: %FRONT_URL%
echo.

if not exist "%VENV_PY%" (
  echo [ERROR] STT virtual environment was not found.
  echo Run setup.bat first.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo [ERROR] node_modules was not found.
  echo Run setup.bat first.
  pause
  exit /b 1
)

call :is_port_open %STT_PORT%
if errorlevel 1 (
  start "AirNote STT Server" "%STT_RUNNER%"
) else (
  echo [OK] STT server is already running on port %STT_PORT%.
)

call :is_port_open 5173
if errorlevel 1 (
  start "AirNote Frontend" "%FRONT_RUNNER%"
) else (
  echo [OK] Frontend is already running on port 5173.
)

echo AirNote frontend and STT are ready.
echo Open this page in Chrome or Edge:
echo %FRONT_URL%
echo.
echo If STT is unavailable, AirNote will continue with gestures, pointer, writing, page controls, and PDF viewer.
pause
endlocal
exit /b 0

:is_port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient; $result = $client.BeginConnect('127.0.0.1', %~1, $null, $null); if (!$result.AsyncWaitHandle.WaitOne(500)) { $client.Close(); exit 1 }; $client.EndConnect($result); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
exit /b %errorlevel%
