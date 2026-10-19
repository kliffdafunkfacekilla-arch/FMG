@echo off
setlocal enabledelayedexpansion

:: Ensure script always executes in its own directory
cd /d "%~dp0"

title Fantasy Map Generator - Aetheria Launcher
color 0B

echo ========================================================
echo    FANTASY MAP GENERATOR - AETHERIA TACTICAL RPG
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

:: 3. Ensure simulation-engine\.env exists
if not exist "simulation-engine\.env" (
    if exist "simulation-engine\.env.example" (
        copy "simulation-engine\.env.example" "simulation-engine\.env" >nul
        echo [INFO] Created simulation-engine\.env from template.
        echo [ACTION] Edit simulation-engine\.env and replace YOUR_PASSWORD with your PostgreSQL password.
    )
)

:: 4. Check simulation-engine dependencies
if not exist "simulation-engine\node_modules" (
    echo [INFO] Installing simulation-engine dependencies...
    cd simulation-engine
    call npm install
    cd ..
)

:: 5. Check player-client dependencies
if not exist "player-client\node_modules" (
    echo [INFO] Installing player-client dependencies...
    cd player-client
    call npm install
    cd ..
)

:: 6. Compile TypeScript backend (always, so source edits take effect)
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

:: 7. Check PostgreSQL on Port 5432
netstat -ano | findstr :5432 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] PostgreSQL not detected on port 5432. Starting database...
    if exist "%USERPROFILE%\scoop\apps\postgresql\current\bin\pg_ctl.exe" (
        "%USERPROFILE%\scoop\apps\postgresql\current\bin\pg_ctl.exe" -D "%USERPROFILE%\scoop\persist\postgresql\data" start
        timeout /t 2 /nobreak >nul
    ) else if exist "%USERPROFILE%\scoop\apps\postgresql\current\bin\postgres.exe" (
        start "PostgreSQL Server" /min "%USERPROFILE%\scoop\apps\postgresql\current\bin\postgres.exe" -D "%USERPROFILE%\scoop\persist\postgresql\data"
        timeout /t 3 /nobreak >nul
    ) else (
        net start postgresql >nul 2>nul
        net start postgresql-x64-16 >nul 2>nul
        net start postgresql-x64-15 >nul 2>nul
    )
)

:: 8. Clean up any stale processes on ports 3000 and 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: 9. Launch Simulation Engine on Port 3000
echo [1/2] Starting Simulation Engine Backend on Port 3000...
start "FMG Simulation Engine (Port 3000)" cmd /k "cd /d ""%~dp0simulation-engine"" && node dist/server.js"

:: 10. Launch Player Tactical Client on Port 5173
echo [2/2] Starting Player Tactical Client on Port 5173...
start "FMG Player Client (Port 5173)" cmd /k "cd /d ""%~dp0player-client"" && npm run dev"

:: 11. Wait for servers to spin up and launch browser
echo.
echo Launching game in default browser in 4 seconds...
ping 127.0.0.1 -n 5 >nul
start http://localhost:5173

echo.
echo ========================================================
echo    SYSTEM ONLINE!
echo ========================================================
echo    - Tactical Client:   http://localhost:5173
echo    - Simulation Engine: http://localhost:3000
echo.
echo    Keep this window open or minimize it.
echo    To stop all servers, run STOP.bat
echo ========================================================
echo.
pause
