@echo off
rem Mohaseb Pro — PostgreSQL service command (run by WinSW as the
rem low-privilege MohasebPG account). On the very first start it
rem initialises the database cluster inside the data directory, then
rem starts the server in the foreground so the service manager owns
rem its lifecycle.
setlocal
set "PGDATA=%MOHASEB_HOME%\pgdata"
set "PGBIN=%~dp0..\pgsql\bin"

if not exist "%PGDATA%\PG_VERSION" (
    echo [pg] Initialising cluster in %PGDATA%
    "%PGBIN%\initdb.exe" -D "%PGDATA%" -U postgres --pwfile="%MOHASEB_HOME%\pg-super.pw" --auth=scram-sha-256 -E UTF8 --locale=C
    if errorlevel 1 (
        echo [pg] initdb failed with errorlevel %errorlevel%
        exit /b 1
    )
)

echo [pg] Starting PostgreSQL on port %MOHASEB_PG_PORT%
"%PGBIN%\postgres.exe" -D "%PGDATA%" -p %MOHASEB_PG_PORT%
endlocal
