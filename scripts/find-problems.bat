@echo off
rem Purpose: Collect Windows streaming diagnostics without typing commands.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0find-problems.ps1" -StationRoot "C:\becoming-many"
set "DIAGNOSTIC_EXIT=%errorlevel%"
echo.
if not "%DIAGNOSTIC_EXIT%"=="0" echo Diagnostic report failed. Photograph the error above.
pause
exit /b %DIAGNOSTIC_EXIT%
