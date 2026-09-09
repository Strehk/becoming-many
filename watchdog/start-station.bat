@echo off
rem One startup owner; PowerShell checks existing processes before launching.
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "C:\becoming-many\scripts\start-station.ps1"
if errorlevel 1 (
  echo Station startup failed. Collecting diagnostics ...
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "C:\becoming-many\scripts\find-problems.ps1" -NoOpen
  echo Open scripts\find-problems.bat to view a fresh report.
  pause
  exit /b 1
)
exit /b 0
