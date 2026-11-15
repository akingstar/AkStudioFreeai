# Local voice engine (quota fallback) - Windows
# Usage: right-click -> Run with PowerShell, ya:
#   powershell -ExecutionPolicy Bypass -File .\local\start-windows.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Add-ToolPath([string]$dir) {
  if ($dir -and (Test-Path $dir) -and ($env:PATH -notlike "*$dir*")) { $env:PATH = "$dir;$env:PATH" }
}

# ffmpeg: PATH, winget per-user package, ya local/tools
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  $pkg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Directory -ErrorAction SilentlyContinue |
    Where-Object Name -like '*FFmpeg*' | Select-Object -First 1
  if ($pkg) {
    $exe = Get-ChildItem $pkg.FullName -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { Add-ToolPath $exe.DirectoryName }
  }
  if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Add-ToolPath (Join-Path $root 'local\tools\ffmpeg\bin')
  }
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg missing. Install: winget install Gyan.FFmpeg  (phir terminal restart) ya local\tools\ffmpeg\bin\ffmpeg.exe rakho" -ForegroundColor Yellow
  exit 1
}

function Find-Python {
  $cands = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python310\python.exe')
  )
  foreach ($c in $cands) { if (Test-Path $c) { return "`"$c`"" } }
  foreach ($c in @('py -3.12', 'py -3.11', 'py -3.10', 'python')) {
    try {
      $null = & cmd /c "$c --version 2>nul"
      if ($LASTEXITCODE -eq 0) { return $c }
    } catch {}
  }
  return $null
}

$py = Find-Python
if (-not $py) {
  Write-Host "Python 3.10-3.12 install karo: winget install Python.Python.3.12" -ForegroundColor Red
  exit 1
}

$venv = Join-Path $root 'local\.venv'
$vpy = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $vpy)) {
  Write-Host "Virtual env bana raha hoon..."
  & cmd /c "$py -m venv `"$venv`""
  if (-not (Test-Path $vpy)) { Write-Host "venv create fail hui." -ForegroundColor Red; exit 1 }
}
& $vpy -m pip install -q -U pip

# torch pin: naye Windows builds (2.15+) par shm.dll load fail hota hai
$hasGpu = (Get-Command nvidia-smi -ErrorAction SilentlyContinue) -ne $null
if ($hasGpu) {
  Write-Host "NVIDIA GPU mila - CUDA build install (bada download, ek baar)..."
  & $vpy -m pip install -q "torch==2.6.0" "torchaudio==2.6.0" --index-url https://download.pytorch.org/whl/cu126
} else {
  Write-Host "GPU nahi mila - CPU build install (slow chalega)..."
  & $vpy -m pip install -q "torch==2.6.0" "torchaudio==2.6.0"
}

& $vpy -m pip install -q -r (Join-Path $root 'local\requirements-local.txt')
if ($LASTEXITCODE -ne 0) { Write-Host "Dependencies install fail hui." -ForegroundColor Red; exit 1 }

# httpx crash karta hai jab NO_PROXY me bracket wale entries hon (jaise [::1])
if ($env:NO_PROXY) {
  $clean = ($env:NO_PROXY -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '[\[\]]' }) -join ','
  $env:NO_PROXY = $clean
  $env:no_proxy = $clean
}

$env:AK_PORT = if ($env:AK_PORT) { $env:AK_PORT } else { '7861' }
$env:AK_HOST = if ($env:AK_HOST) { $env:AK_HOST } else { '127.0.0.1' }
$env:AK_PREWARM = '0'  # local: prewarm nahi (duplicate download + RAM waste)

$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGB -lt 8) {
  Write-Host "WARNING: is PC me $ramGB GB RAM hai. CPU mode me Seed-VC ko ~5-6 GB free chahiye - conversion OOM ho sakta hai (8 GB+ recommended)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Local engine ready: http://127.0.0.1:$env:AK_PORT" -ForegroundColor Green
Write-Host "Pehle conversion par models download honge (~4-5 GB), phir cache se fast."
Write-Host "Site -> Connections -> Local engine -> URL ke saath 'Test' dabao. Band karne ke liye Ctrl+C."
Write-Host ""
& $vpy (Join-Path $root 'spaces\ak-voice\app.py')
