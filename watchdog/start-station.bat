@echo off
rem Purpose: Bring a whole station up from one double-click, or from the
rem   Startup folder after a power-on.
rem Context: A station PC runs five supervised things -- Docker Desktop, the
rem   station stack behind it, SteamVR, PICO Business Streaming, and the kiosk
rem   window. Each is one Watchdog instance with one config; this script starts
rem   them in the order they depend on each other.
rem Responsibility: Check the install, create the log and run directories, and
rem   launch one minimised Watchdog per config.
rem Boundary: Nothing about what each watchdog does belongs here -- that is the
rem   .yaml beside it. This script starts them and exits; it does not wait on
rem   them, and stopping it does not stop them.
rem
rem   Turn Docker Desktop's own "Start Docker Desktop when you sign in" OFF
rem   before using this. docker.yaml owns that process; two owners fight.

setlocal

set "WATCHDOG_DIR=%~dp0"
if "%WATCHDOG_DIR:~-1%"=="\" set "WATCHDOG_DIR=%WATCHDOG_DIR:~0,-1%"
set "WATCHDOG_EXE=%WATCHDOG_DIR%\Watchdog.exe"

rem ---------------------------------------------------------------------------
rem Check the install
rem ---------------------------------------------------------------------------
if not exist "%WATCHDOG_EXE%" (
  echo Watchdog.exe is not next to this script.
  echo Expected: %WATCHDOG_EXE%
  echo.
  echo Copy the repository's watchdog\ folder plus the Artcom Watchdog v0.3.0
  echo binary into C:\Watchdog, then run this again. See README.md.
  pause
  exit /b 1
)

if not exist "%WATCHDOG_DIR%\logs" mkdir "%WATCHDOG_DIR%\logs"
if not exist "%WATCHDOG_DIR%\run" mkdir "%WATCHDOG_DIR%\run"

rem ---------------------------------------------------------------------------
rem Start one watchdog per config, in dependency order
rem ---------------------------------------------------------------------------
rem Docker Desktop first: it carries the compose bring-up, and everything the
rem station serves waits behind its engine.
call :watch docker "Docker Desktop"

rem The health poller. Its own bring-up covers the case where Docker Desktop was
rem already running and docker.yaml therefore had nothing to launch.
call :watch station "station health"

rem The VR chain. Neither depends on the station server, but SteamVR must be up
rem before the PICO streaming client looks for it.
call :watch steamvr "SteamVR"
call :watch pico "PICO streaming"

rem The kiosk window last. It waits for /health on its own before opening, so
rem this ordering is for the logs, not for correctness.
call :watch kiosk "kiosk window"

echo.
echo All watchdogs started. Each runs in its own minimised window; logs are in
echo %WATCHDOG_DIR%\logs.
exit /b 0

rem ---------------------------------------------------------------------------
rem :watch <config-name> <window title>
rem ---------------------------------------------------------------------------
:watch
if not exist "%WATCHDOG_DIR%\%~1.yaml" (
  echo SKIPPED %~2: no %~1.yaml in %WATCHDOG_DIR%
  goto :eof
)
echo Starting %~2 watchdog ...
start "watchdog %~1" /min "%WATCHDOG_EXE%" "%WATCHDOG_DIR%\%~1.yaml"
goto :eof
