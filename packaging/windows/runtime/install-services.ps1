# Mohaseb Pro - application service installation (runs elevated during
# install, after setup-database.ps1). Materialises the WinSW XML from
# its template and installs + starts the MohasebPro service. When the
# database fell back to SQLite there is no PostgreSQL service, so the
# dependency line is removed from the app service definition.

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = 'Stop'
$toolsDir = Join-Path $InstallDir 'tools'
if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }

$mode = 'postgres'
$configPath = Join-Path $DataDir 'config.ini'
if (Test-Path $configPath) {
    foreach ($line in Get-Content $configPath) {
        if ($line -match '^\s*mode\s*=\s*(\w+)') { $mode = $Matches[1].ToLower() }
    }
}

$svcExe = Join-Path $toolsDir 'MohasebPro.exe'
Copy-Item (Join-Path $toolsDir 'WinSW-x64.exe') $svcExe -Force
$template = Get-Content (Join-Path $InstallDir 'runtime\mohaseb-service.xml') -Raw
$xml = $template.Replace('__APPDIR__', $InstallDir).Replace('__DATADIR__', $DataDir)
if ($mode -ne 'postgres') {
    $xml = $xml -replace '\s*<depend>MohasebProPG</depend>', ''
}
Set-Content -LiteralPath (Join-Path $toolsDir 'MohasebPro.xml') -Value $xml -Encoding UTF8

& $svcExe stop 2>$null | Out-Null
& $svcExe uninstall 2>$null | Out-Null
& $svcExe install | Out-Null
if ($LASTEXITCODE -ne 0) { throw "WinSW install for MohasebPro failed ($LASTEXITCODE)" }
& $svcExe start | Out-Null
if ($LASTEXITCODE -ne 0) { throw "MohasebPro service failed to start ($LASTEXITCODE)" }
Write-Host 'MohasebPro service installed and started.'
