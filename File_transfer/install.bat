@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Utilities File Transfer - Setup
echo ==========================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    set "PY=py"
) else (
    set "PY=python"
)

%PY% --version >nul 2>nul
if errorlevel 1 (
    echo Python was not found.
    echo Install Python 3.11+ from https://www.python.org/downloads/
    echo Then run this file again.
    pause
    exit /b 1
)

echo Installing dependencies...
%PY% -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
)

echo.
echo Building Utilities File Transfer.exe...
%PY% -m PyInstaller --noconfirm --clean --onefile --windowed --name "Utilities File Transfer" launcher.py
if errorlevel 1 (
    echo.
    echo Build failed.
    pause
    exit /b 1
)

if not exist "dist\Utilities File Transfer.exe" (
    echo.
    echo EXE was not created.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Build complete!
echo ==========================================
echo EXE: %cd%\dist\Utilities File Transfer.exe
echo.
echo You can copy the EXE anywhere and double-click it.
echo The browser will open automatically.
echo The transfer folder defaults to a "transfers" folder
echo beside the EXE, unless changed in the web UI.
echo.
pause
