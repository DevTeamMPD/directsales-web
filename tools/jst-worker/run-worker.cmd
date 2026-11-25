@echo off
rem JST outreach worker + auto-restart
rem 
rem Keeps restarting node worker.mjs whenever it exits with an error
rem (lost network, crash, watchdog exit 3), after a 30 second wait.
rem Exit code 0 (Ctrl+C clean stop) ends the loop.
rem Scheduled task "JST Outreach Worker" (install-task.ps1) runs this file.
rem Restart history: logs\supervisor.log
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
title JST Outreach Worker
:loop
>> logs\supervisor.log echo %date% %time% start
node worker.mjs
set CODE=%ERRORLEVEL%
>> logs\supervisor.log echo %date% %time% exit %CODE%
if "%CODE%"=="0" goto end
echo Worker exited with code %CODE% - restarting in 30 seconds (close this window to stop)
timeout /t 30 /nobreak >nul
goto loop
:end
echo Worker stopped normally.
endlocal
