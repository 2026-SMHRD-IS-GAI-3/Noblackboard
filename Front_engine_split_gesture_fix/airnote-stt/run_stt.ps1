$ErrorActionPreference = "Stop"

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) {
    Get-Item $venvPython
} else {
    Get-Command python -ErrorAction SilentlyContinue
}

if (-not $python -or $python.FullName -like "*\WindowsApps\python.exe") {
    throw @"
실행 가능한 Python이 없습니다.
Python 3.11 또는 3.12 (64-bit)를 설치하고 'Add python.exe to PATH'를 선택한 뒤
이 스크립트를 다시 실행하세요.
"@
}

$env:AIRNOTE_STT_MODEL = if ($env:AIRNOTE_STT_MODEL) { $env:AIRNOTE_STT_MODEL } else { "medium" }
$env:AIRNOTE_STT_DEVICE = if ($env:AIRNOTE_STT_DEVICE) { $env:AIRNOTE_STT_DEVICE } else { "cuda" }
$env:AIRNOTE_STT_COMPUTE = if ($env:AIRNOTE_STT_COMPUTE) { $env:AIRNOTE_STT_COMPUTE } else { "int8_float16" }
$env:AIRNOTE_STT_BEAM_SIZE = if ($env:AIRNOTE_STT_BEAM_SIZE) { $env:AIRNOTE_STT_BEAM_SIZE } else { "1" }
$cudaRuntime = Join-Path $PSScriptRoot "cuda-runtime"
if (Test-Path $cudaRuntime) {
    $env:Path = "$cudaRuntime;$env:Path"
}

Set-Location $PSScriptRoot
& $python.FullName -m uvicorn app:app --host 127.0.0.1 --port 8000
