@echo off
rem Purpose: Block until the station answers, so the kiosk window does not open
rem   on a browser error page.
rem Context: kiosk.yaml's preAppLaunchCommand, run before every launch of the
rem   browser -- the first one after a cold boot, and every relaunch after a
rem   crash while the stack is still coming back.
rem Responsibility: Poll /health, return as soon as it answers, and give up
rem   after the timeout.
rem Boundary: Giving up succeeds on purpose. A visible Chromium error page is
rem   something a technician can read; a window that never opens is not.
rem
rem   wait-health.bat <health-url> <timeout-seconds>

setlocal

set "HEALTH_URL=%~1"
set "WAIT_TIMEOUT=%~2"

if "%HEALTH_URL%"=="" set "HEALTH_URL=http://localhost/health"
if "%WAIT_TIMEOUT%"=="" set "WAIT_TIMEOUT=300"

set /a waited=0

:wait
curl.exe --silent --fail --max-time 5 --output nul "%HEALTH_URL%" >nul 2>&1
if not errorlevel 1 (
  echo [wait-health] station answered after %waited%s
  exit /b 0
)
if %waited% geq %WAIT_TIMEOUT% (
  echo [wait-health] no answer within %WAIT_TIMEOUT%s, opening the window anyway
  exit /b 0
)
rem ping, not timeout: this script runs under Watchdog with no console of its
rem own, and timeout refuses to run when its input is redirected.
ping -n 4 127.0.0.1 >nul
set /a waited+=3
goto :wait
