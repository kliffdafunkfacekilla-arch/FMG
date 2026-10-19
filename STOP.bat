@echo off
title Fantasy Map Generator - Stop Services
color 0E

echo ========================================================
echo    STOPPING FANTASY MAP GENERATOR SERVICES
echo ========================================================
echo.

:: Kill Port 3000 (Simulation Engine)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping Simulation Engine (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill Port 5173 (Player Client Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Stopping Player Client (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All FMG services have been stopped.
echo.
pause
