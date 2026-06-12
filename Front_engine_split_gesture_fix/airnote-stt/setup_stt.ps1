$ErrorActionPreference = "Stop"

$systemPython = Get-Command python -ErrorAction SilentlyContinue
if (-not $systemPython -or $systemPython.Source -like "*\WindowsApps\python.exe") {
    $localPython = Get-ChildItem "$env:LOCALAPPDATA\Programs\Python" `
        -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike "*\Lib\venv\*" } |
        Select-Object -First 1
    if ($localPython) {
        $systemPython = $localPython
    }
}

if (-not $systemPython -or $systemPython.Source -like "*\WindowsApps\python.exe") {
    throw @"
실행 가능한 Python이 없습니다.
Python 3.11 또는 3.12 (64-bit)를 설치하고 'Add python.exe to PATH'를 선택한 뒤
이 스크립트를 다시 실행하세요.
"@
}

Set-Location $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    & $systemPython.FullName -m venv .venv
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements_airnote_stt.txt

Write-Host ""
Write-Host "설치 완료. .\run_stt.ps1 로 서버를 시작하세요."
