# Mohaseb Pro - database provisioning (runs elevated during install).
#
# Fresh installs: creates the low-privilege MohasebPG account, installs
# and starts the bundled PostgreSQL service, creates the application
# role + database, and writes %ProgramData%\MohasebPro\config.ini.
# If any PostgreSQL step fails, it falls back to SQLite mode so the end
# user still gets a working application, and records the failure in
# logs\setup-database.log.
#
# Upgrades (config.ini already exists): keeps the existing config and
# credentials untouched; only refreshes the service account password
# and the PostgreSQL service registration.
#
# Exit code is always 0: a database problem must not abort the install.

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [int]$PgPort = 54329,
    [string]$PgAccount = 'MohasebPG'
)

$ErrorActionPreference = 'Stop'
$PgUser = 'mohaseb'
$PgDb = 'mohaseb'
$PgBin = Join-Path $InstallDir 'pgsql\bin'
$ConfigPath = Join-Path $DataDir 'config.ini'
$InputsPath = Join-Path $DataDir 'install-inputs.ini'
$LogPath = Join-Path $DataDir 'logs\setup-database.log'

function Write-Log([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch { }
}

function New-Secret([int]$Length) {
    # Alphanumeric only: safe for INI files, service XML and URLs.
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] $Length
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $rng.GetBytes($bytes)
    $rng.Dispose()
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Set-DataDirAcl([string]$Account) {
    # The data dir holds secrets (config.ini, pg-super.pw): restrict it
    # to SYSTEM + Administrators; the DB account only gets the pgdata
    # subtree (granted separately once the cluster exists).
    icacls $DataDir /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    # The service account must traverse the data-dir root and write the
    # database service's wrapper logs: WinSW itself runs as the account,
    # and without these grants the service dies before PostgreSQL even
    # starts. (RX) has no inheritance flags, so it does NOT expose
    # config.ini or other files inside to the account.
    icacls $DataDir /grant:r "${Account}:(RX)" | Out-Null
    $logs = Join-Path $DataDir 'logs'
    icacls $logs /grant:r "${Account}:(OI)(CI)M" 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    $pgdata = Join-Path $DataDir 'pgdata'
    if (-not (Test-Path $pgdata)) { New-Item -ItemType Directory -Path $pgdata -Force | Out-Null }
    icacls $pgdata /grant:r "${Account}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    $media = Join-Path $DataDir 'media'
    icacls $media /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
}

function Install-PgService([string]$Account, [string]$AccountPassword) {
    $toolsDir = Join-Path $InstallDir 'tools'
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }
    $svcExe = Join-Path $toolsDir 'MohasebProPG.exe'
    Copy-Item (Join-Path $InstallDir 'tools\WinSW-x64.exe') $svcExe -Force
    $template = Get-Content (Join-Path $InstallDir 'runtime\postgres-service.xml') -Raw
    # NOTE: no backtick line continuations anywhere in this file.
    # They silently break when the file is checked out with CRLF line
    # endings (git autocrlf on Windows): the backtick escapes the CR
    # instead of the LF and the parser dies on the next line.
    $xml = $template.Replace('__APPDIR__', $InstallDir)
    $xml = $xml.Replace('__DATADIR__', $DataDir)
    $xml = $xml.Replace('__PGPORT__', "$PgPort")
    $xml = $xml.Replace('__PGACCOUNT__', $Account)
    $xml = $xml.Replace('__PGACCOUNTPW__', $AccountPassword)
    $xml = $xml.Replace('__MACHINENAME__', $env:COMPUTERNAME)
    # Pre-flight: prove the service account resolves to a SID before
    # handing it to WinSW (its failure mode here was error 1332,
    # "no mapping between account names and security IDs").
    try {
        $sid = (New-Object System.Security.Principal.NTAccount("$env:COMPUTERNAME\$Account")).Translate([System.Security.Principal.SecurityIdentifier])
        Write-Log "Service account $env:COMPUTERNAME\$Account resolves to SID $sid."
    }
    catch {
        throw "Service account $Account does not resolve on this machine: $($_.Exception.Message)"
    }
    Set-Content -LiteralPath (Join-Path $toolsDir 'MohasebProPG.xml') -Value $xml -Encoding UTF8
    & $svcExe stop 2>$null | Out-Null
    & $svcExe uninstall 2>$null | Out-Null
    & $svcExe install | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "WinSW install for MohasebProPG failed ($LASTEXITCODE)" }
    & $svcExe start | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "MohasebProPG service failed to start ($LASTEXITCODE)" }
}

function Wait-PgReady([int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        & (Join-Path $PgBin 'pg_isready.exe') -h 127.0.0.1 -p $PgPort 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Invoke-Psql([string]$SuperPassword, [string]$Sql) {
    $env:PGPASSWORD = $SuperPassword
    try {
        $sqlFile = Join-Path $env:TEMP ('mohaseb-sql-' + [guid]::NewGuid().ToString('N') + '.sql')
        Set-Content -LiteralPath $sqlFile -Value $Sql -Encoding UTF8
        $psqlArgs = @('-h', '127.0.0.1', '-p', "$PgPort", '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', $sqlFile)
        & (Join-Path $PgBin 'psql.exe') @psqlArgs | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "psql failed ($LASTEXITCODE)" }
    }
    finally {
        Remove-Item $sqlFile -ErrorAction SilentlyContinue
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------- main
try {
    foreach ($sub in @('', 'logs', 'media')) {
        $p = if ($sub) { Join-Path $DataDir $sub } else { $DataDir }
        if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
    }
    $isUpgrade = Test-Path $ConfigPath

    # The service account password is (re)generated on every install so
    # the WinSW XML always matches the account.
    $accountPassword = New-Secret 24
    $account = Get-LocalUser -Name $PgAccount -ErrorAction SilentlyContinue
    $secure = ConvertTo-SecureString $accountPassword -AsPlainText -Force
    if ($account) {
        Set-LocalUser -Name $PgAccount -Password $secure -PasswordNeverExpires $true
    }
    else {
        New-LocalUser -Name $PgAccount -Password $secure -PasswordNeverExpires -Description 'Mohaseb Pro bundled PostgreSQL service account' | Out-Null
    }
    Set-DataDirAcl $PgAccount

    if ($isUpgrade) {
        Write-Log 'Existing config.ini found (upgrade): keeping config and DB credentials.'
        Install-PgService $PgAccount $accountPassword
        if (-not (Wait-PgReady 120)) { throw 'PostgreSQL did not become ready after upgrade.' }
        # A previous install may have died between writing config.ini
        # and creating the application role/database; make sure both
        # exist, using the password already recorded in config.ini.
        $superPwFile = Join-Path $DataDir 'pg-super.pw'
        $urlLine = Get-Content $ConfigPath | Where-Object { $_ -match '^\s*url\s*=' } | Select-Object -First 1
        if ((Test-Path $superPwFile) -and $urlLine -and ($urlLine -match 'postgres://[^:]+:([^@]+)@')) {
            $existingDbPw = $Matches[1]
            $superPw = (Get-Content $superPwFile -Raw).Trim()
            Invoke-Psql $superPw @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PgUser') THEN
    CREATE ROLE $PgUser LOGIN PASSWORD '$existingDbPw';
  ELSE
    ALTER ROLE $PgUser WITH LOGIN PASSWORD '$existingDbPw';
  END IF;
END `$`$;
SELECT 'CREATE DATABASE $PgDb OWNER $PgUser'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$PgDb')\gexec
"@
            Write-Log 'Application role and database verified for upgrade.'
        }
        Write-Log 'PostgreSQL service refreshed and running.'
        exit 0
    }

    # ------------------------------------------------------------ fresh
    $secretKey = New-Secret 64
    $dbPassword = New-Secret 28
    $superPassword = New-Secret 28

    # Cluster superuser password file: consumed by initdb on the PG
    # service's first start. Kept (ACL-restricted) for later support.
    $pwFile = Join-Path $DataDir 'pg-super.pw'
    Set-Content -LiteralPath $pwFile -Value $superPassword -Encoding ASCII -NoNewline
    icacls $pwFile /inheritance:r /grant:r 'SYSTEM:F' 'Administrators:F' "${PgAccount}:R" | Out-Null

    $mode = 'postgres'
    try {
        Install-PgService $PgAccount $accountPassword
        if (-not (Wait-PgReady 180)) { throw 'PostgreSQL did not become ready in time.' }
        Invoke-Psql $superPassword @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PgUser') THEN
    CREATE ROLE $PgUser LOGIN PASSWORD '$dbPassword';
  ELSE
    ALTER ROLE $PgUser WITH LOGIN PASSWORD '$dbPassword';
  END IF;
END `$`$;
SELECT 'CREATE DATABASE $PgDb OWNER $PgUser'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$PgDb')\gexec
"@
        Write-Log 'PostgreSQL ready; application role and database created.'
    }
    catch {
        $mode = 'sqlite'
        Write-Log "PostgreSQL setup failed, falling back to SQLite. Error: $($_.Exception.Message)"
        try {
            $svcExe = Join-Path $InstallDir 'tools\MohasebProPG.exe'
            if (Test-Path $svcExe) { & $svcExe stop 2>$null | Out-Null; & $svcExe uninstall 2>$null | Out-Null }
        } catch { }
    }

    # Admin credentials collected by the installer wizard page.
    $adminUser = 'admin'
    $adminPassword = ''
    if (Test-Path $InputsPath) {
        foreach ($line in Get-Content $InputsPath) {
            if ($line -match '^admin_user=(.*)$') { $adminUser = $Matches[1].Trim() }
            if ($line -match '^admin_password=(.*)$') { $adminPassword = $Matches[1] }
        }
        Remove-Item $InputsPath -Force -ErrorAction SilentlyContinue
    }

    $lines = @(
        '[app]'
        'port = 4173'
        "secret_key = $secretKey"
        'allowed_hosts = *'
        ''
        '[database]'
        "mode = $mode"
    )
    if ($mode -eq 'postgres') {
        $lines += "url = postgres://${PgUser}:${dbPassword}@127.0.0.1:${PgPort}/${PgDb}"
        $lines += "pg_port = $PgPort"
    }
    if ($adminPassword) {
        $lines += ''
        $lines += '[firstrun]'
        $lines += "admin_user = $adminUser"
        $lines += "admin_password = $adminPassword"
    }
    Set-Content -LiteralPath $ConfigPath -Value $lines -Encoding UTF8
    Write-Log "config.ini written (database mode: $mode)."
}
catch {
    # Last-resort guard: never let provisioning abort the whole install.
    try { Write-Log "setup-database fatal error: $($_.Exception.Message)" } catch { }
}
exit 0
