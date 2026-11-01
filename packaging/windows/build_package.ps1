# Mohaseb Pro - one-command Windows installer build.
#
# Prerequisites on the BUILD machine (not on end-user machines):
#   * Python 3 (py launcher) - used by build_package.py
#   * Node.js LTS            - to build the frontend
#   * Inno Setup 6 or 7      - to compile the installer (ISCC.exe)
#
# Usage:  powershell -ExecutionPolicy Bypass -File build_package.ps1
#         (optional: -IsccPath "C:\path\to\ISCC.exe" to point at the
#          compiler explicitly when auto-detection fails)
# Output: packaging\windows\output\MohasebPro-Setup-<VERSION>.exe

param([string]$IsccPath)

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
# Detection order: explicit -IsccPath, PATH, the registry App Paths
# entry Inno Setup writes for ISCC.exe, then the standard install
# folders of Inno Setup 7 and 6 (system-wide and per-user).
$iscc = $null
if ($IsccPath -and (Test-Path $IsccPath)) { $iscc = $IsccPath }
if (-not $iscc) {
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}
if (-not $iscc) {
    foreach ($rp in @(
            'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\ISCC.exe',
            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\ISCC.exe',
            'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\ISCC.exe')) {
        $hit = (Get-ItemProperty $rp -ErrorAction SilentlyContinue).'(default)'
        if ($hit -and (Test-Path $hit)) { $iscc = $hit; break }
    }
}
if (-not $iscc) {
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, "$env:LOCALAPPDATA\Programs")) {
        if (-not $root) { continue }
        foreach ($v in @(7, 6)) {
            $candidate = Join-Path $root "Inno Setup $v\ISCC.exe"
            if (Test-Path $candidate) { $iscc = $candidate; break }
        }
        if ($iscc) { break }
    }
}
if (-not $iscc) {
    throw 'Inno Setup (ISCC.exe) not found. Install Inno Setup 6 or 7 from https://jrsoftware.org/isdl.php, or pass -IsccPath "C:\path\to\ISCC.exe".'
}
Write-Host "Using Inno Setup compiler: $iscc"

& $iscc "/DAppVersion=$Version" (Join-Path $Here 'installer.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }

$exe = Join-Path $Here "output\MohasebPro-Setup-$Version.exe"
Write-Host ""
Write-Host "Installer ready: $exe"
