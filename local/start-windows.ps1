# Local voice engine (quota fallback) — Windows
# Usage: right-click -> Run with PowerShell, ya:
#   powershell -ExecutionPolicy Bypass -File .\local\start-windows.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Find-Python {
  foreach ($c in @('py -3.12', 'py -3.11', 'py -3.10', 'python')) {
    try {
      $null = & cmd /c "$c --version 2>nul"
      if ($LASTEXITCODE -eq 0) { return $c }
    } catch {}
  }
  return $null
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git chahiye: https://git-scm.com/download/win" -ForegroundColor Red; exit 1
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg missing. Install: winget install Gyan.FFmpeg  (phir terminal restart)" -ForegroundColor Yellow
  exit 1
}

$py = Find-Python
if (-not $py) {
  Write-Host "Python 3.10-3.12 install karo (Add python.exe to PATH tick): https://www.python.org/downloads/" -ForegroundColor Red
  exit 1
}

$venv = Join-Path $root 'local\.venv'
$vpy = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $vpy)) {
  Write-Host "Virtual env bana raha hoon..."
  & cmd /c "$py -m venv `"$venv`""
}
& $vpy -m pip install -q -U pip

$hasGpu = (Get-Command nvidia-smi -ErrorAction SilentlyContinue) -ne $null
if ($hasGpu) {
  Write-Host "NVIDIA GPU mila — CUDA build install (bada download, ek baar)..."
  & $vpy -m pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu126
} else {
  Write-Host "GPU nahi mila — CPU build install (slow chalega)..."
  & $vpy -m pip install -q torch torchaudio
}

& $vpy -m pip install -q -r (Join-Path $root 'local\requirements-local.txt')
if ($LASTEXITCODE -ne 0) { Write-Host "Dependencies install fail hui." -ForegroundColor Red; exit 1 }

$env:AK_PORT = '7861'
$env:AK_HOST = '127.0.0.1'
Write-Host ""
Write-Host "Local engine ready: http://127.0.0.1:7861" -ForegroundColor Green
Write-Host "Pehli baar model download ~4-5 GB (startup par background me)."
Write-Host "Site -> Connections -> Local engine -> URL ke saath 'Test' dabao. Band karne ke liye Ctrl+C."
Write-Host ""
& $vpy (Join-Path $root 'spaces\ak-voice\app.py')
