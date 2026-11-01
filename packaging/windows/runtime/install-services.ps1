# Mohaseb Pro - application service installation (runs elevated during
# install, after setup-database.ps1). Materialises the WinSW XML from
# its template and installs + starts the MohasebPro service. When the
# database fell back to SQLite there is no PostgreSQL service, so the
# dependency line is removed from the app service definition.
# Everything is logged to logs\install-services.log; a failure exits
# non-zero so the installer reports it instead of finishing silently.

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = 'Stop'
$LogPath = Join-Path $DataDir 'logs\install-services.log'
function Write-Log([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch { }
}

try {
    $toolsDir = Join-Path $InstallDir 'tools'
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }

    $mode = 'postgres'
    $configPath = Join-Path $DataDir 'config.ini'
    if (Test-Path $configPath) {
        foreach ($line in Get-Content $configPath) {
            if ($line -match '^\s*mode\s*=\s*(\w+)') { $mode = $Matches[1].ToLower() }
        }
    }
    else {
        # setup-database.ps1 always writes config.ini, even on its
        # SQLite fallback. A missing file means provisioning never ran;
        # do NOT guess postgres (the dependency on the nonexistent
        # MohasebProPG service would stop this service from starting).
        # The launcher self-heals a minimal SQLite config instead.
        $mode = 'sqlite'
        Write-Log 'WARNING: config.ini not found - assuming SQLite mode (no PostgreSQL dependency).'
    }
    Write-Log "Installing MohasebPro service (database mode: $mode)."

    $svcExe = Join-Path $toolsDir 'MohasebPro.exe'
    Copy-Item (Join-Path $toolsDir 'WinSW-x64.exe') $svcExe -Force
    $template = Get-Content (Join-Path $InstallDir 'runtime\mohaseb-service.xml') -Raw
    $xml = $template.Replace('__APPDIR__', $InstallDir).Replace('__DATADIR__', $DataDir)
    if ($mode -ne 'postgres') {
        $xml = $xml -replace '\s*<depend>MohasebProPG</depend>', ''
        Write-Log 'SQLite mode: removed the PostgreSQL service dependency.'
    }
    Set-Content -LiteralPath (Join-Path $toolsDir 'MohasebPro.xml') -Value $xml -Encoding UTF8

    & $svcExe stop 2>$null | Out-Null
    & $svcExe uninstall 2>$null | Out-Null
    & $svcExe install | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "WinSW install for MohasebPro failed ($LASTEXITCODE)" }
    # Let standard users control this service from the tray icon
    # without elevation: the default service security descriptor plus
    # query-status (LC), start (RP) and stop (WP) for Builtin Users
    # (BU). Non-fatal — the service itself is already installed.
    try {
        $sddl = 'D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWLOCRRC;;;IU)(A;;CCLCSWLOCRRC;;;SU)(A;;LCRPWP;;;BU)'
        & sc.exe sdset MohasebPro $sddl | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Log 'Granted local users start/stop rights on the MohasebPro service (tray control).' }
        else { Write-Log "WARNING: sc sdset returned $LASTEXITCODE; tray start/stop may need elevation." }
    }
    catch {
        Write-Log "WARNING: could not set service permissions: $($_.Exception.Message)"
    }
    & $svcExe start | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "MohasebPro service failed to start ($LASTEXITCODE)" }
    Write-Log 'MohasebPro service installed and started.'
}
catch {
    Write-Log "install-services FAILED: $($_.Exception.Message)"
    exit 1
}
exit 0
