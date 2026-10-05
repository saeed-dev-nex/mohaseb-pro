@echo off
rem Resolve a working project virtual environment without relying on the
rem absolute interpreter path recorded when another machine created it.

set "VENV_DIR=%BACKEND%\.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

if exist "%VENV_PYTHON%" (
    "%VENV_PYTHON%" --version >nul 2>&1
    if not errorlevel 1 goto :venv_ready
)

echo [INFO] Preparing the backend Python environment...

set "PYTHON_BOOTSTRAP="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_BOOTSTRAP=py -3"

if not defined PYTHON_BOOTSTRAP (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_BOOTSTRAP=python"
)

if not defined PYTHON_BOOTSTRAP (
    echo [ERROR] Python was not found. Install Python 3 and add it to PATH,
    echo         or install the Windows Python Launcher, then run this script again.
    exit /b 1
)

if exist "%VENV_DIR%\pyvenv.cfg" (
    %PYTHON_BOOTSTRAP% -m venv --clear "%VENV_DIR%"
) else (
    %PYTHON_BOOTSTRAP% -m venv "%VENV_DIR%"
)
if errorlevel 1 (
    echo [ERROR] Could not create the backend Python environment.
    exit /b 1
)

:venv_ready
set "BACKEND_PYTHON=%VENV_PYTHON%"
rem A previous installation may have stopped before installing any packages.
rem Check every direct dependency, including Pillow's compiled image module.
call :check_dependencies
if not errorlevel 1 exit /b 0

echo [INFO] Installing missing or incomplete backend dependencies...
rem Allow more time to fetch large package indexes on slow connections.
"%BACKEND_PYTHON%" -m pip install --timeout 60 --retries 3 -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Could not install backend dependencies.
    echo         Check your internet connection and pip package index, then run this script again.
    exit /b 1
)

call :check_dependencies
if errorlevel 1 (
    echo [ERROR] Backend dependencies are still incomplete. Check the pip output above.
    exit /b 1
)

exit /b 0

:check_dependencies
"%BACKEND_PYTHON%" -c "import django, rest_framework, rest_framework_simplejwt, corsheaders; from PIL import Image; assert django.VERSION >= (4, 2)" >nul 2>&1
if errorlevel 1 exit /b 1
"%BACKEND_PYTHON%" -m pip check >nul 2>&1
exit /b %errorlevel%
