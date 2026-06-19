@echo off
setlocal

set "ROOT=%~dp0"
set "PYTHON=%ROOT%.venv\Scripts\python.exe"
set "AIRNOTE_STT_MODEL_ROOT=%ROOT%models"
set "AIRNOTE_STT_LOCAL_ONLY=1"
if "%AIRNOTE_STT_PORT%"=="" set "AIRNOTE_STT_PORT=8000"

if not exist "%PYTHON%" (
  echo [ERROR] Bundled STT Python was not found:
  echo %PYTHON%
  pause
  exit /b 1
)

set "MODEL_BIN="
for /r "%AIRNOTE_STT_MODEL_ROOT%" %%f in (model.bin) do (
  if exist "%%f" if not defined MODEL_BIN set "MODEL_BIN=%%f"
)

if not defined MODEL_BIN (
  echo [ERROR] Bundled faster-whisper medium model was not found:
  echo %AIRNOTE_STT_MODEL_ROOT%
  echo Required file: model.bin
  echo Run setup.bat on this computer or copy the complete stt_server\models folder.
  pause
  exit /b 1
)

echo [OK] STT model file found:
echo %MODEL_BIN%

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient('127.0.0.1', %AIRNOTE_STT_PORT%); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [OK] AirNote STT server is already running:
  echo http://localhost:%AIRNOTE_STT_PORT%/health
  echo.
  exit /b 0
)

cd /d "%ROOT%"
"%PYTHON%" -m uvicorn app:app --host 127.0.0.1 --port %AIRNOTE_STT_PORT%

endlocal
