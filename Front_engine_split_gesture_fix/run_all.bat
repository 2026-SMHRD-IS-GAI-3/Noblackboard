@echo off
setlocal EnableExtensions

call :find_runtime "%~dp0"
if not "%AIRNOTE_RUNTIME%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%AIRNOTE_RUNTIME%" all
  set "CODE=%ERRORLEVEL%"
  if not "%AIRNOTE_NO_PAUSE%"=="1" pause
  exit /b %CODE%
)

echo [WARN] Root runtime script was not found. Starting frontend and local STT only.
set "ROOT=%~dp0"
set "STT_DIR=%ROOT%stt_server"
set "STT_RUNNER=%STT_DIR%\run_stt.bat"
set "FRONT_RUNNER=%ROOT%run_frontend.bat"
set "STT_PORT=8000"
set "FRONT_PORT=5173"
set "FRONT_URL=http://localhost:%FRONT_PORT%/pages/presentation.html"

if not exist "%FRONT_RUNNER%" (
  echo [ERROR] Frontend runner was not found: %FRONT_RUNNER%
  pause
  exit /b 1
)

if exist "%STT_RUNNER%" (
  call :is_port_open %STT_PORT%
  if errorlevel 1 (
    start "AirNote STT Server" "%STT_RUNNER%"
  ) else (
    echo [OK] STT server is already running on port %STT_PORT%.
  )
) else (
  echo [WARN] STT runner was not found: %STT_RUNNER%
)

call :is_port_open %FRONT_PORT%
if errorlevel 1 (
  start "AirNote Frontend" "%FRONT_RUNNER%"
) else (
  echo [OK] Frontend is already running on port %FRONT_PORT%.
)

echo AirNote frontend startup requested.
echo %FRONT_URL%
pause
exit /b 0

:find_runtime
set "SEARCH_DIR=%~f1"
:find_runtime_loop
if exist "%SEARCH_DIR%scripts\airnote_runtime.ps1" (
  set "AIRNOTE_RUNTIME=%SEARCH_DIR%scripts\airnote_runtime.ps1"
  exit /b 0
)
if exist "%SEARCH_DIR%..\scripts\airnote_runtime.ps1" (
  for %%R in ("%SEARCH_DIR%..") do set "AIRNOTE_RUNTIME=%%~fR\scripts\airnote_runtime.ps1"
  exit /b 0
)
for /d %%D in ("%SEARCH_DIR%*") do (
  if exist "%%~fD\scripts\airnote_runtime.ps1" (
    set "AIRNOTE_RUNTIME=%%~fD\scripts\airnote_runtime.ps1"
    exit /b 0
  )
)
for %%P in ("%SEARCH_DIR%..") do set "PARENT=%%~fP\"
if /i "%PARENT%"=="%SEARCH_DIR%" exit /b 1
if /i "%PARENT%"=="%SystemDrive%\" exit /b 1
set "SEARCH_DIR=%PARENT%"
goto :find_runtime_loop

:is_port_open
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object Net.Sockets.TcpClient; $result = $client.BeginConnect('127.0.0.1', %~1, $null, $null); if (!$result.AsyncWaitHandle.WaitOne(500)) { $client.Close(); exit 1 }; $client.EndConnect($result); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
exit /b %errorlevel%
