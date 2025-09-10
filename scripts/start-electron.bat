@echo off

REM Read .env file and set variables
if exist .env (
    echo Loading environment variables from .env file...
    for /f "usebackq tokens=1,2 delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set "%%a=%%b"
        )
    )
    echo ELECTRON_LOG_VERBOSE=%ELECTRON_LOG_VERBOSE%
) else (
    echo No .env file found
)

REM Start Electron with environment variables
echo Starting Electron with environment variables...
set NODE_ENV=development
npx electron-nightly .
