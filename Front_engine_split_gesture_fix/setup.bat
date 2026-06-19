@echo off
setlocal

set "ROOT=%~dp0"
set "STT_DIR=%ROOT%stt_server"
set "VENV_DIR=%STT_DIR%\.venv"
set "STT_MODEL_LOG=%STT_DIR%\stt_model_install.log"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"
set "PYTHONUNBUFFERED=1"

echo.
echo ========================================
echo AirNote setup
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [OK] Node %%v

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or not on PATH.
  pause
  exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
  echo [WARN] Java was not found on PATH. AirNote frontend/STT can still run, but install Java if your backend needs it.
) else (
  echo [OK] Java found
)

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"
if "%PYTHON_CMD%"=="" (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if "%PYTHON_CMD%"=="" (
  echo [ERROR] Python 3.10+ is not installed or not on PATH.
  echo Install Python from https://www.python.org/downloads/
  pause
  exit /b 1
)
echo [OK] Python command: %PYTHON_CMD%

echo.
echo [1/4] Installing frontend dependencies...
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/4] Creating Python virtual environment...
if exist "%VENV_DIR%\Scripts\python.exe" (
  "%VENV_DIR%\Scripts\python.exe" -c "import sys" >nul 2>nul
  if errorlevel 1 (
    echo [INFO] The copied Python virtual environment belongs to another PC.
    echo [INFO] Recreating stt_server\.venv for this PC...
    rmdir /s /q "%VENV_DIR%"
  )
)
if not exist "%VENV_DIR%\Scripts\python.exe" (
  %PYTHON_CMD% -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo [ERROR] Failed to create Python virtual environment.
    pause
    exit /b 1
  )
)

echo.
echo [3/4] Installing STT server dependencies...
call "%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
call "%VENV_DIR%\Scripts\python.exe" -m pip install -r "%STT_DIR%\requirements.txt"
if errorlevel 1 (
  echo [ERROR] Python dependency install failed.
  pause
  exit /b 1
)

echo.
echo [4/4] Preparing faster-whisper medium model...
echo This downloads the model only the first time. It will be reused from stt_server\models.
echo Download log: %STT_MODEL_LOG%
echo ===== AirNote STT model install %DATE% %TIME% ===== > "%STT_MODEL_LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%VENV_DIR%\Scripts\python.exe' '%STT_DIR%\prepare_model.py' 2>&1 | Tee-Object -FilePath '%STT_MODEL_LOG%' -Append; exit $LASTEXITCODE"
if errorlevel 1 (
  echo [ERROR] STT model preparation failed.
  echo Details were saved here:
  echo %STT_MODEL_LOG%
  type "%STT_MODEL_LOG%"
  pause
  exit /b 1
)

echo.
echo ========================================
echo Setup complete.
echo Run run_all.bat to start AirNote.
echo ========================================
pause
endlocal
