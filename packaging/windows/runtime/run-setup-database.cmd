@echo off
rem Bootstrap shim for setup-database.ps1.
rem
rem Takes NO arguments on purpose: Inno Setup launches this file via
rem   cmd /c "<path>" "<arg1>" "<arg2>"
rem and cmd.exe's /c quote-stripping mangles any command line that
rem contains more than one quoted segment - the shim then never ran
rem at all (this silently killed provisioning in real installs).
rem With a single quoted path and the paths derived here instead,
rem the invocation is the one form cmd /c handles correctly.
rem
rem All PowerShell output - including parser errors - is appended to
rem logs\provisioning-console.log so a failed step leaves a trace.
setlocal
set "RUNTIME=%~dp0"
for %%I in ("%RUNTIME%..") do set "APPDIR=%%~fI"
set "DATADIR=%ProgramData%\MohasebPro"
if not exist "%DATADIR%\logs" mkdir "%DATADIR%\logs"
echo ==== %DATE% %TIME% setup-database ==== >> "%DATADIR%\logs\provisioning-console.log"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%RUNTIME%setup-database.ps1" -InstallDir "%APPDIR%" -DataDir "%DATADIR%" >> "%DATADIR%\logs\provisioning-console.log" 2>&1
exit /b %errorlevel%
