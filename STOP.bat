@echo off
title Fantasy Map Generator - Stop Services
color 0E

echo ========================================================
echo    STOPPING SIMULATION ENGINE & OBSERVER SERVICES
echo ========================================================
echo.

:: Kill Port 3000 (Simulation Engine)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping Simulation Engine (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill Port 5174 (Observer Dashboard Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do (
    echo Stopping Observer Dashboard (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All Ostraka simulation services have been stopped.
echo.
pause
