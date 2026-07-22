@echo off
title BearFighter Trading Server
color 0A
cls
echo ========================================
echo    BEARFIGHTER TRADING - Server Start
echo    By Vaibhav
echo ========================================
echo.
echo Checking if server is already running...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo [OK] Server is already running on port 3000!
    echo.
    echo Open browser: http://localhost:3000
    echo Admin panel:  http://localhost:3000/admin
    echo.
    pause
    exit /b
)

echo.
echo Starting server...
echo.
cd /d "%~dp0"
start /b node index.js > server.log 2>&1
timeout /t 3 /nobreak >nul

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo ========================================
    echo    SERVER STARTED SUCCESSFULLY!
    echo ========================================
    echo.
    echo Dashboard: http://localhost:3000
    echo Admin:     http://localhost:3000/admin
    echo.
    echo Press any key to open browser...
    pause >nul
    start http://localhost:3000
) else (
    echo ========================================
    echo    ERROR: Server failed to start!
    echo ========================================
    echo.
    echo Check server.log for details.
    echo.
    pause
)
