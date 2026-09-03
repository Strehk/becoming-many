@echo off
rem Purpose: Turn "the station answers /health" into a heartbeat file Watchdog
rem   can monitor.
rem Context: The supervised application of station.yaml. Docker keeps the
rem   container running and docker.yaml keeps Docker Desktop running, but
rem   neither can tell a serving station from a hung engine, a crash loop, or an
rem   unbound port. An HTTP request can.
rem Responsibility: Rewrite the heartbeat file for as long as the station
rem   answers, and stop touching it the moment it does not.
rem Boundary: This script never recovers anything. A stale heartbeat is what
rem   Watchdog acts on, and the bring-up lives in station.yaml's
rem   preAppLaunchCommand.
rem
rem   poll-health.bat <health-url> <heartbeat-file> <interval-seconds>

setlocal

set "HEALTH_URL=%~1"
set "HEARTBEAT_FILE=%~2"
set "INTERVAL=%~3"

if "%HEALTH_URL%"=="" set "HEALTH_URL=http://localhost/health"
if "%HEARTBEAT_FILE%"=="" set "HEARTBEAT_FILE=C:\becoming-many\watchdog\run\station.hb"
if "%INTERVAL%"=="" set "INTERVAL=10"

for %%F in ("%HEARTBEAT_FILE%") do if not exist "%%~dpF" mkdir "%%~dpF"

rem Watchdog treats a missing heartbeat file as a successful check, so write it
rem once up front. From here on a stale file means a station that stopped
rem answering, never one that was never asked.
>"%HEARTBEAT_FILE%" echo starting

rem ping -n N spaces N-1 seconds between the first and last packet.
set /a SLEEP=%INTERVAL%+1

echo [poll-health] watching %HEALTH_URL% every %INTERVAL%s

:poll
curl.exe --silent --fail --max-time 5 --output nul "%HEALTH_URL%" >nul 2>&1
if errorlevel 1 (
  echo [poll-health] %DATE% %TIME% no answer from %HEALTH_URL%
) else (
  >"%HEARTBEAT_FILE%" echo %DATE% %TIME%
)
ping -n %SLEEP% 127.0.0.1 >nul
goto :poll
