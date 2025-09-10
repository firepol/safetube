@echo off
setlocal enabledelayedexpansion

REM SafeTube Development Server Killer (Windows)
REM This script kills any development servers running on common development ports

REM Load environment variables from .env file
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set "%%a=%%b"
        )
    )
)

REM Check if verbose logging is enabled (command line takes precedence over .env)
if "%ELECTRON_LOG_VERBOSE%"=="" set ELECTRON_LOG_VERBOSE=false

echo 🔍 Checking for running development servers...

REM Function to kill process on a specific port
call :kill_port 5173 "Vite Dev Server"
call :kill_port 3000 "React Dev Server"
call :kill_port 8080 "Alternative Dev Server"
call :kill_port 4173 "Vite Preview Server"

REM Also kill any node processes that might be hanging
if "%ELECTRON_LOG_VERBOSE%"=="true" echo Checking for hanging Node.js processes...

for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr /v "PID"') do (
    set "pid=%%i"
    set "pid=!pid:"=!"
    if not "!pid!"=="" (
        echo Found hanging Node.js process: !pid!
        if "%ELECTRON_LOG_VERBOSE%"=="true" (
            tasklist /fi "pid eq !pid!" /fo table
        )
        taskkill /f /pid !pid! >nul 2>&1
        if !errorlevel! equ 0 (
            echo ✅ Successfully killed Node.js process !pid!
        )
    )
)

if "%ELECTRON_LOG_VERBOSE%"=="true" echo 🎉 Server cleanup complete!
if "%ELECTRON_LOG_VERBOSE%"=="true" echo You can now safely run 'yarn electron:dev:win'

goto :eof

:kill_port
set port=%1
set process_name=%2

if "%ELECTRON_LOG_VERBOSE%"=="true" echo Checking port %port% (%process_name%)...

REM Find processes using the port
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%port%') do (
    set "pid=%%a"
    if not "!pid!"=="" (
        echo Found process on port %port%: !pid!
        if "%ELECTRON_LOG_VERBOSE%"=="true" (
            netstat -aon | findstr :%port%
        )
        taskkill /f /pid !pid! >nul 2>&1
        if !errorlevel! equ 0 (
            echo ✅ Successfully killed process on port %port%
        ) else (
            echo ⚠️  Could not kill process !pid! on port %port%
        )
    )
)

if "%ELECTRON_LOG_VERBOSE%"=="true" echo ✅ No processes found on port %port%
goto :eof
