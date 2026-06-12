@echo off
setlocal

set "ROOT=%~dp0"
set "PYTHON=%ROOT%.venv\Scripts\python.exe"
set "AIRNOTE_STT_MODEL_ROOT=%ROOT%models"
set "AIRNOTE_STT_LOCAL_ONLY=1"

if not exist "%PYTHON%" (
  echo [ERROR] Bundled STT Python was not found:
  echo %PYTHON%
  pause
  exit /b 1
)

if not exist "%AIRNOTE_STT_MODEL_ROOT%\models--Systran--faster-whisper-medium" (
  echo [ERROR] Bundled faster-whisper medium model was not found:
  echo %AIRNOTE_STT_MODEL_ROOT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient('127.0.0.1', 5000); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [OK] AirNote STT server is already running:
  echo http://localhost:5000/health
  echo.
  exit /b 0
)

cd /d "%ROOT%"
"%PYTHON%" -m uvicorn app:app --host 127.0.0.1 --port 5000

endlocal
