@echo off
rem Purpose: Open the two station windows in a Chromium browser with no UI
rem   around them, from one double-click on the station PC.
rem Context: Runs on the Windows station PC once the station server is up
rem   (docker compose up -d, or bun run station).
rem Responsibility: Find a browser, wait for the server, and start the show
rem   window and the operator window as separate browser instances.
rem Boundary: What the flags do and where they stop locking down is
rem   ..\KIOSK.md. What the pages are is ..\station\README.md.

setlocal

rem ---------------------------------------------------------------------------
rem Per-station settings. Positions and sizes suit a 2048-wide monitor; set
rem BM_BROWSER beforehand to force a specific browser executable.
rem ---------------------------------------------------------------------------
set "STATION_URL=http://localhost"
set "PROFILE_ROOT=%LOCALAPPDATA%\becoming-many"
set "SHOW_WINDOW="--window-position=0,0" "--window-size=1280,800""
set "CONDUCTOR_WINDOW="--window-position=1290,0" "--window-size=760,800""

rem Flags both windows need. A separate --user-data-dir per window is what
rem makes the second command start its own browser instead of handing its URL
rem to the first one, which would open a normal tab and drop every flag.
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
rem Wait for the station server, so the windows do not open on an error page
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
echo The station server did not answer within 30 seconds. Opening the windows
echo anyway - start it with "docker compose up -d" and reload them.
goto :launch

:server_up
echo Station server is up.

rem ---------------------------------------------------------------------------
rem Open the windows
rem ---------------------------------------------------------------------------
:launch
start "" "%BM_BROWSER%" ^
  --user-data-dir="%PROFILE_ROOT%\kiosk-show" ^
  --app=%STATION_URL%/ ^
  %SHOW_WINDOW% %COMMON_FLAGS% ^
  --autoplay-policy=no-user-gesture-required ^
  "--disable-features=Translate,TranslateUI" ^
  --check-for-update-interval=31536000 ^
  --overscroll-history-navigation=0

start "" "%BM_BROWSER%" ^
  --user-data-dir="%PROFILE_ROOT%\kiosk-conductor" ^
  --app=%STATION_URL%/conductor.html ^
  %CONDUCTOR_WINDOW% %COMMON_FLAGS%

echo Show window and operator window opened.
endlocal
