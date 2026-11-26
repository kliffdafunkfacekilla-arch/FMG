@echo off
setlocal enabledelayedexpansion

:: One-click launcher: database, Ollama, simulation server, world-clock worker and observer dashboard.
:: Run STOP.bat to shut everything down again.
cd /d "%~dp0"

title Ostraka Launcher
color 0B

echo ========================================================
echo    OSTRAKA SIMULATION ENGINE ^& OBSERVER DASHBOARD
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your system PATH!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Ensure simulation-engine\.env exists
if not exist "simulation-engine\.env" (
    if exist "simulation-engine\.env.example" (
        copy "simulation-engine\.env.example" "simulation-engine\.env" >nul
        echo [INFO] Created simulation-engine\.env from template.
        echo [ACTION] Edit simulation-engine\.env and replace YOUR_PASSWORD with your PostgreSQL password.
    )
)

:: 3. Install dependencies on first run
if not exist "simulation-engine\node_modules" (
    echo [INFO] Installing simulation-engine dependencies...
    cd simulation-engine
    call npm install
    cd ..
)

:: 4. Compile the TypeScript backend (always, so source edits take effect)
echo [INFO] Compiling simulation-engine TypeScript...
cd simulation-engine
call npx tsc
if %ERRORLEVEL% neq 0 (
    cd ..
    color 0C
    echo [ERROR] TypeScript compile failed. Fix the errors above and run START.bat again.
    pause
    exit /b 1
)
cd ..

:: 5. PostgreSQL on port 5432
netstat -ano | findstr :5432 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] PostgreSQL not detected on port 5432. Starting database...
    if exist "%USERPROFILE%\scoop\apps\postgresql\current\bin\pg_ctl.exe" (
        "%USERPROFILE%\scoop\apps\postgresql\current\bin\pg_ctl.exe" -D "%USERPROFILE%\scoop\persist\postgresql\data" -l "%USERPROFILE%\scoop\persist\postgresql\postgres.log" start
        timeout /t 2 /nobreak >nul
    ) else (
        net start postgresql >nul 2>nul
        net start postgresql-x64-16 >nul 2>nul
        net start postgresql-x64-15 >nul 2>nul
    )
) else (
    echo [OK] PostgreSQL is running.
)

:: 6. Ollama on port 11434 (local LLM for narration)
netstat -ano | findstr :11434 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        echo [INFO] Starting Ollama...
        start "Ollama" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        echo [WARN] Ollama not found. The simulation runs, but GM narration will not.
    )
) else (
    echo [OK] Ollama is running.
)

:: 7. Stop anything left over from a previous run
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*simWorker.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: 8. Simulation server (API + embedded dashboard) on port 3000
echo [1/3] Starting simulation server on port 3000...
start "Ostraka Server (Port 3000)" /min cmd /k "cd /d ""%~dp0simulation-engine"" && node dist/server.js"

:: 9. Wait until the server answers (it runs database migrations on start)
set /a tries=0
:waitserver
set /a tries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:3000/ | Out-Null; exit 0 } catch { if ($_.Exception.Response) { exit 0 } else { exit 1 } }" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if !tries! geq 30 (
        color 0C
        echo [ERROR] The server did not answer within 60 seconds. Check the "Ostraka Server" window.
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    goto waitserver
)
echo [OK] Server is up.

:: 10. World-clock worker: runs ticks in the background (autoplay needs it)
echo [2/3] Starting world-clock worker...
start "Ostraka World Clock Worker" /min cmd /k "cd /d ""%~dp0simulation-engine"" && node dist/worker/simWorker.js"

:: 11. Observer dashboard (Vite) on port 5174
echo [3/3] Starting observer dashboard on port 5174...
start "Ostraka Dashboard (Port 5174)" /min cmd /k "cd /d ""%~dp0simulation-engine"" && npm run observer"
ping 127.0.0.1 -n 5 >nul
start http://localhost:5174

echo.
echo ========================================================
echo    SYSTEM ONLINE
echo ========================================================
echo    - Observer dashboard:  http://localhost:5174
echo    - Simulation server:   http://localhost:3000
echo    - World-clock worker:  running (minimized window)
echo.
echo    The service windows are minimized on the taskbar.
echo    To stop everything, run STOP.bat
echo ========================================================
echo.
pause
