# Mohaseb Pro - database provisioning (runs elevated during install).
#
# Fresh installs: creates the low-privilege MohasebPG account, runs
# initdb AS that account (PostgreSQL refuses to run under an
# administrative identity - including LocalSystem - and the server
# process must own its data directory), registers the PostgreSQL
# service with pg_ctl (PostgreSQL's own service tool; the account is
# validated by the Service Control Manager itself), creates the
# application role + database, and writes config.ini.
# If any PostgreSQL step fails, it falls back to SQLite mode so the
# end user still gets a working application, and records the failure
# in logs\setup-database.log.
#
# Why not WinSW for this service: WinSW 2.12 failed to register ANY
# named account on a real machine (error 1332 ERROR_NONE_MAPPED, for
# both ".\user" and "MACHINE\user") although the same names resolved
# fine through Windows' own NTAccount lookup in this very script.
#
# Upgrades (config.ini already exists): keeps the existing config and
# credentials untouched; in postgres mode it refreshes the service
# account password, re-registers the service and verifies the
# application role + database exist. In sqlite mode it does nothing
# to PostgreSQL at all.
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
$PgData = Join-Path $DataDir 'pgdata'
$ConfigPath = Join-Path $DataDir 'config.ini'
$InputsPath = Join-Path $DataDir 'install-inputs.ini'
$LogPath = Join-Path $DataDir 'logs\setup-database.log'

function Write-Log([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch { }
}

function New-Secret([int]$Length) {
    # Alphanumeric only: safe for INI files, service arguments and URLs.
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] $Length
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $rng.GetBytes($bytes)
    $rng.Dispose()
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Set-DataDirAcl([string]$Account) {
    # The data dir holds secrets (config.ini, pg-super.pw): restrict it
    # to SYSTEM + Administrators. The DB account only traverses the
    # root (RX, no inheritance - it cannot read the secrets inside),
    # writes its own server logs, and fully owns the pgdata subtree.
    icacls $DataDir /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    icacls $DataDir /grant:r "${Account}:(RX)" | Out-Null
    $logs = Join-Path $DataDir 'logs'
    icacls $logs /grant:r "${Account}:(OI)(CI)M" 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    if (-not (Test-Path $PgData)) { New-Item -ItemType Directory -Path $PgData -Force | Out-Null }
    icacls $PgData /grant:r "${Account}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    $media = Join-Path $DataDir 'media'
    icacls $media /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
}

function Ensure-PgCluster([string]$AccountPassword) {
    if (Test-Path (Join-Path $PgData 'PG_VERSION')) {
        Write-Log 'Existing PostgreSQL cluster found; keeping it.'
        return
    }
    # initdb must run as the service account: the postmaster refuses
    # administrative identities (LocalSystem included) and requires
    # the data directory to be owned by the user running the server.
    $pwFile = Join-Path $DataDir 'pg-super.pw'
    $secure = ConvertTo-SecureString $AccountPassword -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential("$env:COMPUTERNAME\$PgAccount", $secure)
    $initOut = Join-Path $DataDir 'logs\initdb.out.log'
    $initErr = Join-Path $DataDir 'logs\initdb.err.log'
    $initArgs = "-D `"$PgData`" -U postgres --pwfile=`"$pwFile`" --auth=scram-sha-256 -E UTF8 --locale=C"
    Write-Log 'Initialising PostgreSQL cluster (initdb as the service account)...'
    $proc = Start-Process -FilePath (Join-Path $PgBin 'initdb.exe') -ArgumentList $initArgs -Credential $cred -NoNewWindow -Wait -PassThru -RedirectStandardOutput $initOut -RedirectStandardError $initErr
    if ($proc.ExitCode -ne 0) { throw "initdb failed with exit code $($proc.ExitCode); see logs\initdb.err.log" }
    Write-Log 'PostgreSQL cluster initialised.'
}

function Register-PgService([string]$AccountPassword) {
    $pgCtl = Join-Path $PgBin 'pg_ctl.exe'
    & $pgCtl unregister -N MohasebProPG 2>$null | Out-Null
    # Server logs land in the shared logs folder (forward slashes are
    # accepted by PostgreSQL on Windows and survive the quoting path).
    $logDir = ($DataDir -replace '\\', '/') + '/logs'
    $opts = "-p $PgPort -c logging_collector=on -c log_directory=$logDir"
    $regArgs = @('register', '-N', 'MohasebProPG', '-U', ".\$PgAccount", '-P', $AccountPassword, '-D', $PgData, '-S', 'auto', '-o', $opts)
    & $pgCtl @regArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_ctl register failed ($LASTEXITCODE)" }
    & sc.exe start MohasebProPG | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "MohasebProPG service failed to start ($LASTEXITCODE)" }
    Write-Log 'PostgreSQL service registered (pg_ctl) and started.'
}

function Unregister-PgService {
    try { Stop-Service -Name 'MohasebProPG' -Force -ErrorAction SilentlyContinue } catch { }
    try { & (Join-Path $PgBin 'pg_ctl.exe') unregister -N MohasebProPG 2>$null | Out-Null } catch { }
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
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($sqlFile, $Sql, $utf8NoBom)
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
    # the pg_ctl registration always matches the account.
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
        $modeLine = Get-Content $ConfigPath | Where-Object { $_ -match '^\s*mode\s*=' } | Select-Object -First 1
        $configMode = 'sqlite'
        if ($modeLine -match '=\s*(\w+)') { $configMode = $Matches[1] }
        if ($configMode -ne 'postgres') {
            Write-Log "Config database mode is '$configMode'; PostgreSQL service not needed."
            Unregister-PgService
            exit 0
        }
        Ensure-PgCluster $accountPassword
        Register-PgService $accountPassword
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

    # Cluster superuser password file: consumed by initdb (which runs
    # as the service account, hence its read grant). Kept
    # (ACL-restricted) for later support.
    $pwFile = Join-Path $DataDir 'pg-super.pw'
    Set-Content -LiteralPath $pwFile -Value $superPassword -Encoding ASCII -NoNewline
    icacls $pwFile /inheritance:r /grant:r 'SYSTEM:F' 'Administrators:F' "${PgAccount}:R" | Out-Null

    $mode = 'postgres'
    try {
        Ensure-PgCluster $accountPassword
        Register-PgService $accountPassword
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
        Unregister-PgService
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
    # No-BOM write: PowerShell 5.1's Set-Content -Encoding UTF8 emits a
    # BOM, which Python's configparser in the launcher rejects with
    # MissingSectionHeaderError (the service then crash-loops).
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ConfigPath, ($lines -join "`r`n") + "`r`n", $utf8NoBom)
    Write-Log "config.ini written (database mode: $mode)."
}
catch {
    # Last-resort guard: never let provisioning abort the whole install.
    try { Write-Log "setup-database fatal error: $($_.Exception.Message)" } catch { }
}
exit 0
