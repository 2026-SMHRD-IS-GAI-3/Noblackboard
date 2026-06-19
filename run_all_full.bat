@echo off
setlocal
set "ROOT=%~dp0"
set "AIRNOTE_NO_PAUSE=1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\airnote_runtime.ps1" all
set "CODE=%ERRORLEVEL%"
if not "%AIRNOTE_NO_PAUSE_OUTER%"=="1" pause
exit /b %CODE%
