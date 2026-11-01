@echo off
rem Bootstrap shim for setup-database.ps1.
rem A hidden "powershell -File" run that fails (parser error, launch
rem problem, anything) leaves NO trace behind. This shim captures the
rem step's complete console output into the data dir's logs, so every
rem failure is diagnosable afterwards.
rem   %1 = install dir ({app})   %2 = data dir (ProgramData\MohasebPro)
setlocal
set "APPDIR=%~1"
set "DATADIR=%~2"
if not exist "%DATADIR%\logs" mkdir "%DATADIR%\logs"
echo ==== %DATE% %TIME% setup-database ==== >> "%DATADIR%\logs\provisioning-console.log"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\runtime\setup-database.ps1" -InstallDir "%APPDIR%" -DataDir "%DATADIR%" >> "%DATADIR%\logs\provisioning-console.log" 2>&1
exit /b %errorlevel%
