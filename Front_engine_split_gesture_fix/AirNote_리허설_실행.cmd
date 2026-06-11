@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo =====================================
echo   AirNote 실행
echo =====================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo Node.js LTS를 설치한 뒤 다시 실행하세요.
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist package.json (
  echo [오류] package.json을 찾을 수 없습니다.
  echo 이 파일을 Front 폴더 루트에서 실행해야 합니다.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [안내] node_modules가 없어 의존성을 설치합니다.
  call npm install
  if errorlevel 1 (
    echo [오류] npm install 실패
    pause
    exit /b 1
  )
)

echo [안내] 프론트 서버를 실행합니다.
echo [안내] 브라우저가 자동으로 열리지 않으면 아래 주소로 접속하세요.
echo http://localhost:5173/
echo.

start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173/"

call npm run dev -- --host 127.0.0.1

pause
