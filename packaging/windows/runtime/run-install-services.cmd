@echo off
rem Bootstrap shim for install-services.ps1 — see run-setup-database.cmd
rem for why this exists (no silent provisioning failures).
rem   %1 = install dir ({app})   %2 = data dir (ProgramData\MohasebPro)
setlocal
set "APPDIR=%~1"
set "DATADIR=%~2"
if not exist "%DATADIR%\logs" mkdir "%DATADIR%\logs"
echo ==== %DATE% %TIME% install-services ==== >> "%DATADIR%\logs\provisioning-console.log"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\runtime\install-services.ps1" -InstallDir "%APPDIR%" -DataDir "%DATADIR%" >> "%DATADIR%\logs\provisioning-console.log" 2>&1
exit /b %errorlevel%
