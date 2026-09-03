@echo off
rem Purpose: Wait for the Docker engine to accept commands, then bring the
rem   station stack up.
rem Context: Called by docker.yaml after Docker Desktop launches, and by
rem   station.yaml before every start of the health poller. Docker Desktop
rem   reports a running process well before its engine answers, so a plain
rem   `docker compose up -d` on a cold machine fails on nothing being there yet.
rem Responsibility: Poll `docker info` until it succeeds, then run the compose
rem   bring-up once, and report failure through the exit code.
rem Boundary: The single place the compose command is spelled out. Change the
rem   project location here, not in the .yaml files.

setlocal

rem ---------------------------------------------------------------------------
rem Per-station settings
rem ---------------------------------------------------------------------------
set "PROJECT_DIR=C:\becoming-many"
set "COMPOSE_FILE=%PROJECT_DIR%\docker-compose.yml"
set "ENGINE_TIMEOUT=300"

if not exist "%COMPOSE_FILE%" (
  echo [docker-up] no compose file at %COMPOSE_FILE%
  echo [docker-up] check PROJECT_DIR at the top of this script
  exit /b 1
)

rem ---------------------------------------------------------------------------
rem Wait for the engine
rem ---------------------------------------------------------------------------
set /a waited=0

:wait_for_engine
docker info >nul 2>&1
if not errorlevel 1 goto :engine_up
if %waited% geq %ENGINE_TIMEOUT% (
  echo [docker-up] the Docker engine did not answer within %ENGINE_TIMEOUT%s
  exit /b 1
)
rem ping, not timeout: this script runs under Watchdog with no console of its
rem own, and timeout refuses to run when its input is redirected.
ping -n 6 127.0.0.1 >nul
set /a waited+=5
goto :wait_for_engine

:engine_up
echo [docker-up] engine answered after %waited%s

rem ---------------------------------------------------------------------------
rem Bring the station up
rem ---------------------------------------------------------------------------
rem Deliberately no `docker compose pull`. Updating the running version is an
rem explicit operator action (docs/direction/deployment.md); pulling here would
rem let a power-cycle change the show under its operators mid-exhibition.
rem   docker compose --project-directory "%PROJECT_DIR%" -f "%COMPOSE_FILE%" pull

docker compose --project-directory "%PROJECT_DIR%" -f "%COMPOSE_FILE%" up -d
if errorlevel 1 (
  echo [docker-up] compose up failed
  exit /b 1
)

echo [docker-up] station stack is up
exit /b 0
