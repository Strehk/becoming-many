@echo off
rem Purpose: Open the station window in a Chromium browser with no UI around
rem   it, from one double-click on the station PC.
rem Context: Runs on the Windows station PC once the station server is up
rem   (docker compose up -d, or bun run station).
rem Responsibility: Find a browser, wait for the server, and start the
rem   conductor window as its own browser instance.
rem Boundary: What the flags do and where they stop locking down is
rem   ..\KIOSK.md. What the process serves is README.md beside this file.

setlocal

rem ---------------------------------------------------------------------------
rem Per-station settings. Position and size suit a 2048-wide monitor; set
rem BM_BROWSER beforehand to force a specific browser executable.
rem ---------------------------------------------------------------------------
set "STATION_URL=http://localhost"
set "PROFILE_ROOT=%LOCALAPPDATA%\becoming-many"
set "STATION_WINDOW="--window-position=0,0" "--window-size=1600,1000""

rem A dedicated --user-data-dir keeps this window its own browser instance, so
rem an already-open personal Chrome cannot swallow the URL as a plain tab and
rem drop every flag.
set "COMMON_FLAGS=--no-first-run --no-default-browser-check --noerrdialogs"
set "COMMON_FLAGS=%COMMON_FLAGS% --disable-session-crashed-bubble"
set "COMMON_FLAGS=%COMMON_FLAGS% --disable-background-timer-throttling"
set "COMMON_FLAGS=%COMMON_FLAGS% --disable-backgrounding-occluded-windows"
set "COMMON_FLAGS=%COMMON_FLAGS% --disable-renderer-backgrounding"

rem ---------------------------------------------------------------------------
rem Find a browser
rem ---------------------------------------------------------------------------
if defined BM_BROWSER goto :browser_found

set "BM_BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%BM_BROWSER%" goto :browser_found
set "BM_BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%BM_BROWSER%" goto :browser_found
set "BM_BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%BM_BROWSER%" goto :browser_found
set "BM_BROWSER=%ProgramFiles%\Chromium\Application\chrome.exe"
if exist "%BM_BROWSER%" goto :browser_found
set "BM_BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%BM_BROWSER%" goto :browser_found

echo No Chromium browser found. Install Chrome, or set BM_BROWSER to the
echo full path of the executable and run this script again.
exit /b 1

:browser_found
echo Browser: %BM_BROWSER%

rem ---------------------------------------------------------------------------
rem Wait for the station server, so the window does not open on an error page
rem ---------------------------------------------------------------------------
echo Waiting for the station server at %STATION_URL% ...
set /a tries=0

:wait_for_server
curl --silent --fail --max-time 2 "%STATION_URL%/health" >nul 2>&1
if not errorlevel 1 goto :server_up
set /a tries+=1
if %tries% geq 30 goto :server_missing
timeout /t 1 /nobreak >nul
goto :wait_for_server

:server_missing
echo The station server did not answer within 30 seconds. Opening the window
echo anyway - start it with "docker compose up -d" and reload it.
goto :launch

:server_up
echo Station server is up.

rem ---------------------------------------------------------------------------
rem Open the window
rem ---------------------------------------------------------------------------
:launch
start "" "%BM_BROWSER%" ^
  --user-data-dir="%PROFILE_ROOT%\kiosk-station" ^
  --app=%STATION_URL%/conductor.html ^
  %STATION_WINDOW% %COMMON_FLAGS% ^
  --autoplay-policy=no-user-gesture-required ^
  "--disable-features=Translate,TranslateUI" ^
  --check-for-update-interval=31536000 ^
  --overscroll-history-navigation=0

echo Station window opened.
endlocal
