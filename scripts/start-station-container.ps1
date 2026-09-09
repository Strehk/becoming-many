# Purpose: Start the selected station image from either Watchdog recovery hook.
# Boundary: Never fetch, build or change deployment mode; invalid state fails closed.
. "$PSScriptRoot\station-deployment.ps1"
Initialize-Station
try { $lock = Open-DeploymentLock }
catch [IO.IOException] {
    Write-Host '[docker-up] Deployment or another bring-up is active; skipping this hook.'
    exit 0
}
try {
    Wait-Engine
    Start-StationContainer
} finally { $lock.Dispose() }
