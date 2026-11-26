@echo off
title Ostraka - Stop Services
color 0E

echo ========================================================
echo    STOPPING OSTRAKA SERVICES
echo ========================================================
echo.

:: World-clock worker first, so it finishes no tick against a dead server
echo Stopping world-clock worker...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*simWorker.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:: Simulation server (port 3000)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping simulation server (PID: %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Observer dashboard (port 5174)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do (
    echo Stopping observer dashboard (PID: %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Close the leftover service windows
taskkill /f /fi "WINDOWTITLE eq Ostraka Server*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ostraka World Clock*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ostraka Dashboard*" >nul 2>&1

echo.
echo All Ostraka services have been stopped.
echo (PostgreSQL and Ollama are left running.)
echo.
pause
