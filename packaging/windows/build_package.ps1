# Mohaseb Pro - one-command Windows installer build.
#
# Prerequisites on the BUILD machine (not on end-user machines):
#   * Python 3 (py launcher) - used by build_package.py
#   * Node.js LTS            - to build the frontend
#   * Inno Setup 6           - to compile the installer (ISCC.exe)
#
# Usage:  powershell -ExecutionPolicy Bypass -File build_package.ps1
# Output: packaging\windows\output\MohasebPro-Setup-<VERSION>.exe

$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = (Resolve-Path (Join-Path $Here '..\..')).Path
$Version = (Get-Content (Join-Path $Repo 'VERSION') -Raw).Trim()

Write-Host "== Mohaseb Pro installer build (version $Version) =="

# --- payload staging -------------------------------------------------
$python = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $python = 'py' }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $python = 'python' }
else { throw 'Python 3 not found. Install it from python.org and retry.' }

& $python (Join-Path $Here 'build_package.py') --clean
if ($LASTEXITCODE -ne 0) { throw "build_package.py failed ($LASTEXITCODE)" }

# --- compile the installer -------------------------------------------
$iscc = $null
$candidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) }
if ($candidates) { $iscc = $candidates[0] }
if (-not $iscc) {
    throw 'Inno Setup 6 (ISCC.exe) not found. Download it from https://jrsoftware.org/isdl.php and retry.'
}

& $iscc "/DAppVersion=$Version" (Join-Path $Here 'installer.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }

$exe = Join-Path $Here "output\MohasebPro-Setup-$Version.exe"
Write-Host ""
Write-Host "Installer ready: $exe"
