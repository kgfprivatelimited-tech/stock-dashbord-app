@echo off
title BearFighter Trading - Stop Server
color 0C
cls
echo ========================================
echo    STOPPING SERVER...
echo ========================================
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process %%a...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo WARNING: Server may still be running.
) else (
    echo Server stopped successfully!
)
echo.
pause
