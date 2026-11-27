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

:: Free the LLM's memory (taskkill above gives the server no chance to; Ollama itself keeps running)
echo Unloading the Ollama model...
powershell -NoProfile -Command "try { (Invoke-RestMethod http://127.0.0.1:11434/api/ps -TimeoutSec 3).models | ForEach-Object { Invoke-RestMethod http://127.0.0.1:11434/api/generate -Method Post -ContentType 'application/json' -Body (@{ model = $_.name; keep_alive = 0 } | ConvertTo-Json) -TimeoutSec 10 | Out-Null } } catch {}" >nul 2>&1

:: Close the leftover service windows
taskkill /f /fi "WINDOWTITLE eq Ostraka Server*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ostraka World Clock*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ostraka Dashboard*" >nul 2>&1

echo.
echo All Ostraka services have been stopped.
echo (PostgreSQL and Ollama are left running.)
echo.
pause
