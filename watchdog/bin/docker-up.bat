@echo off
rem Purpose: Reuse the selected release/branch image for both Watchdog hooks.
rem Boundary: PowerShell owns engine readiness and deployment state; no updates here.
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\becoming-many\scripts\start-station-container.ps1"
exit /b %errorlevel%
