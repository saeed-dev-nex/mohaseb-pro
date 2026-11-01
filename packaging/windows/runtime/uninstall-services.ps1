# Mohaseb Pro - service removal (runs elevated during uninstall).
# Stops and unregisters both services. The data directory
# (%ProgramData%\MohasebPro: database cluster, config, media, logs) is
# intentionally kept; the uninstaller only removes program files.

param(
    [Parameter(Mandatory = $true)][string]$InstallDir
)

foreach ($name in @('MohasebPro', 'MohasebProPG')) {
    $svcExe = Join-Path $InstallDir "tools\$name.exe"
    if (Test-Path $svcExe) {
        & $svcExe stop 2>$null | Out-Null
        & $svcExe uninstall 2>$null | Out-Null
    }
    else {
        # Fallback if the wrapper exe is already gone.
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($svc) {
            Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
            sc.exe delete $name | Out-Null
        }
    }
}
exit 0
