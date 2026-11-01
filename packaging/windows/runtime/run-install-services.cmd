@echo off
rem Bootstrap shim for install-services.ps1 - argument-free for the
rem same cmd /c quote-stripping reason documented in
rem run-setup-database.cmd. All output lands in
rem logs\provisioning-console.log.
setlocal
set "RUNTIME=%~dp0"
for %%I in ("%RUNTIME%..") do set "APPDIR=%%~fI"
set "DATADIR=%ProgramData%\MohasebPro"
if not exist "%DATADIR%\logs" mkdir "%DATADIR%\logs"
echo ==== %DATE% %TIME% install-services ==== >> "%DATADIR%\logs\provisioning-console.log"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%RUNTIME%install-services.ps1" -InstallDir "%APPDIR%" -DataDir "%DATADIR%" >> "%DATADIR%\logs\provisioning-console.log" 2>&1
exit /b %errorlevel%
