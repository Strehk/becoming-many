@echo off
rem Purpose: Deploy david_refactor by double-click or the Windows Run dialog.
rem Boundary: PowerShell handles safety and services; keep errors visible here.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-branch.ps1"
set "DEPLOY_EXIT=%errorlevel%"
echo.
if not "%DEPLOY_EXIT%"=="0" echo Deployment failed. Keep this window open to read the error.
pause
exit /b %DEPLOY_EXIT%
