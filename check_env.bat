@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\airnote_runtime.ps1" check
set "CODE=%ERRORLEVEL%"
if not "%AIRNOTE_NO_PAUSE%"=="1" pause
exit /b %CODE%
