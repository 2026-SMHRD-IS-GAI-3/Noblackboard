@echo off
setlocal EnableExtensions

call :find_runtime "%~dp0"
if "%AIRNOTE_RUNTIME%"=="" (
  echo [ERROR] AirNote runtime script was not found.
  echo Move this file back into the AirNote project folder, or keep scripts\airnote_runtime.ps1 in the project.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%AIRNOTE_RUNTIME%" backend
set "CODE=%ERRORLEVEL%"
if not "%AIRNOTE_NO_PAUSE%"=="1" pause
exit /b %CODE%

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
