@echo off
cd /d "%~dp0"

REM 1. Tenta usar o python do venv local (minimizado e estavel)
if exist "%~dp0venv\Scripts\python.exe" (
    start "" /min "%~dp0venv\Scripts\python.exe" "%~dp0app.py"
    exit /b 0
)

if exist "%~dp0venv\Scripts\pythonw.exe" (
    start "" "%~dp0venv\Scripts\pythonw.exe" "%~dp0app.py"
    exit /b 0
)

REM 2. Se o venv nao existir, usa o Python do sistema (PATH)
where pythonw >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" pythonw app.py
    exit /b 0
)

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" /min python app.py
    exit /b 0
)

REM 3. Tenta o inicializador padrao do Windows (py launcher)
where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" /min py app.py
    exit /b 0
)

echo [ERRO] Nenhum interpretador Python funcional foi localizado nesta maquina.
pause
exit /b 1
