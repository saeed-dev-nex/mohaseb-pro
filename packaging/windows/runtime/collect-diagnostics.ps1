# Mohaseb Pro - one-click diagnostics collector.
# Gathers the service states, the setup logs and the runtime config
# (secrets redacted) into a single text file on the Desktop, ready to
# send for support. Self-elevates: reading the data dir requires admin.

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$ErrorActionPreference = 'Continue'
$DataDir = Join-Path $env:ProgramData 'MohasebPro'
$Out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'MohasebPro-Diagnostics.txt'
$sb = New-Object System.Text.StringBuilder

function Add-Line([string]$Text) { [void]$sb.AppendLine($Text) }
function Add-Section([string]$Title) { Add-Line ''; Add-Line "===== $Title =====" }
function Add-Cmd([scriptblock]$Cmd) {
    try { Add-Line ((& $Cmd) 2>&1 | Out-String) }
    catch { Add-Line "ERROR: $($_.Exception.Message)" }
}

Add-Line "Mohaseb Pro diagnostics - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Section 'Services (state)'
Add-Cmd { sc.exe query MohasebPro }
Add-Cmd { sc.exe query MohasebProPG }
Add-Section 'Services (config / binary path)'
Add-Cmd { sc.exe qc MohasebPro }
Add-Cmd { sc.exe qc MohasebProPG }
Add-Section 'Listening ports 4173 / 54329'
Add-Cmd { Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 4173, 54329 } | Format-Table -AutoSize }
Add-Section 'Firewall rule'
Add-Cmd { netsh advfirewall firewall show rule name='Mohaseb Pro' }
Add-Section 'Data directory'
Add-Cmd { Get-ChildItem $DataDir -Recurse -Depth 2 -ErrorAction SilentlyContinue |
    Select-Object FullName, Length | Format-Table -AutoSize }
Add-Section 'config.ini (redacted)'
if (Test-Path (Join-Path $DataDir 'config.ini')) {
    foreach ($line in Get-Content (Join-Path $DataDir 'config.ini')) {
        if ($line -match '(?i)secret_key|password|url\s*=') { Add-Line ($line -replace '=.*', '= ***') }
        else { Add-Line $line }
    }
}
else { Add-Line 'config.ini NOT FOUND' }
Add-Section 'logs (tails)'
$logsDir = Join-Path $DataDir 'logs'
if (Test-Path $logsDir) {
    foreach ($f in Get-ChildItem $logsDir -Filter *.log -ErrorAction SilentlyContinue) {
        Add-Line "--- $($f.Name) (last 80 lines)"
        Add-Cmd { Get-Content $f.FullName -Tail 80 }
    }
}
else { Add-Line 'logs directory NOT FOUND' }

Set-Content -LiteralPath $Out -Value $sb.ToString() -Encoding UTF8
Write-Host "Diagnostics written to: $Out"
Write-Host 'Send that file for support. Passwords and keys inside it are redacted.'
Pause
