# Purpose: Start the installed station Watchdogs once, in dependency order.
# Context: Windows PowerShell 5.1; existing YAML files own supervision policy.
# Boundary: Never stop processes, reserve ports or take over externally started apps.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Open-StartupLock {
    param([string]$Directory)
    return [IO.File]::Open((Join-Path $Directory 'startup.lock'),
        [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}

function Test-ApplicationRunning {
    param([string]$Name, [object[]]$Processes, [string]$WatchdogDirectory)
    $applicationNames = switch ($Name) {
        'docker' { @('Docker Desktop.exe') }
        'pico' { @('Business Streaming.exe') }
        'steamvr' { @('vrmonitor.exe', 'vrserver.exe') }
        default { @() }
    }
    if (@($Processes | Where-Object { $_.Name -in $applicationNames }).Count) { return $true }
    if ($Name -eq 'kiosk') {
        $profile = '--user-data-dir=' + (Join-Path $WatchdogDirectory 'run\kiosk-station')
        return [bool]@($Processes | Where-Object {
            $_.Name -eq 'chrome.exe' -and $_.CommandLine -and $_.CommandLine.Contains($profile)
        }).Count
    }
    if ($Name -eq 'station') {
        $poller = Join-Path $WatchdogDirectory 'bin\poll-health.bat'
        return [bool]@($Processes | Where-Object {
            $_.Name -eq 'cmd.exe' -and $_.CommandLine -and $_.CommandLine.Contains($poller)
        }).Count
    }
    return $false
}

function Start-StationWatchdog {
    param([string]$Name, [int]$Port, [string]$WatchdogDirectory)
    $config = Join-Path $WatchdogDirectory "$Name.yaml"
    if (!(Test-Path -LiteralPath $config -PathType Leaf)) { throw "Missing Watchdog config: $config." }
    $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    # A just-started owner may not have bound its control port yet.
    $configPattern = '(?i)(?:^|[\s"])' + [regex]::Escape($config.Replace('/', '\')) + '(?:$|[\s"])'
    $owners = @($processes | Where-Object {
        $_.Name -eq 'Watchdog.exe' -and $_.CommandLine -and
            $_.CommandLine.Replace('/', '\') -match $configPattern
    })
    if ($owners.Count -gt 1) {
        throw "Multiple $Name Watchdogs are running (PID $($owners.ProcessId -join ', ')). Run scripts\find-problems.bat."
    }
    if ($owners.Count) {
        Write-Host "SKIPPED ${Name}: Watchdog already running (PID $($owners.ProcessId -join ', '))."
        return
    }
    $listeners = @(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })
    if ($listeners.Count) {
        throw "Cannot start ${Name}: control port $Port belongs to unrecognized PID $($listeners.OwningProcess -join ', '). Run scripts\find-problems.bat."
    }
    if (Test-ApplicationRunning $Name $processes $WatchdogDirectory) {
        Write-Warning "SKIPPED ${Name}: application already running outside this Watchdog. Existing process is retained; it is not supervised by this startup. Disable its separate autostart before the next reboot."
        return
    }
    if ($Name -eq 'pico') {
        $picoListeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
            Where-Object { $_.LocalPort -eq 49667 })
        if ($picoListeners.Count) {
            throw "Cannot start pico: port 49667 already belongs to PID $($picoListeners.OwningProcess -join ', '). Run scripts\find-problems.bat."
        }
    }
    Write-Host "Starting $Name Watchdog ..."
    $launched = Start-Process -FilePath (Join-Path $WatchdogDirectory 'Watchdog.exe') -ArgumentList ('"' + $config + '"') `
        -WorkingDirectory $WatchdogDirectory -WindowStyle Minimized -PassThru
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $control = @(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })
        if (@($control | Where-Object { $_.OwningProcess -eq $launched.Id }).Count) { return }
        if ($control.Count) { throw "${Name}: another process took control port $Port during startup." }
        Start-Sleep -Seconds 1
    }
    throw "${Name}: Watchdog did not open control port $Port within 10 seconds. See watchdog/logs/$Name.log."
}

function Start-Station {
    param([string]$WatchdogDirectory)
    if (!(Test-Path -LiteralPath (Join-Path $WatchdogDirectory 'Watchdog.exe') -PathType Leaf)) {
        throw "Watchdog.exe is missing from $WatchdogDirectory. See watchdog/README.md."
    }
    [void][IO.Directory]::CreateDirectory((Join-Path $WatchdogDirectory 'logs'))
    $runDirectory = Join-Path $WatchdogDirectory 'run'
    [void][IO.Directory]::CreateDirectory($runDirectory)
    $lock = $null
    $transcribing = $false
    try {
        try { $lock = Open-StartupLock $runDirectory }
        catch [IO.IOException] {
            Write-Warning 'Another station startup is already in progress. No duplicate startup was launched.'
            return
        }
        Start-Transcript -Path (Join-Path $WatchdogDirectory 'logs/startup.log') -Force | Out-Null
        $transcribing = $true
        Start-StationWatchdog 'docker' 2348 $WatchdogDirectory
        Start-StationWatchdog 'pico' 2347 $WatchdogDirectory
        Start-StationWatchdog 'station' 2349 $WatchdogDirectory
        Write-Host 'Waiting 30s before SteamVR ...'
        Start-Sleep -Seconds 30
        Start-StationWatchdog 'steamvr' 2346 $WatchdogDirectory
        Write-Host 'Waiting 15s before the kiosk ...'
        Start-Sleep -Seconds 15
        Start-StationWatchdog 'kiosk' 2350 $WatchdogDirectory
        Write-Host "Startup checks complete. Review any SKIPPED messages. Headset connection is not verified. Logs: $WatchdogDirectory\logs"
    } finally {
        try { if ($transcribing) { Stop-Transcript | Out-Null } }
        finally { if ($null -ne $lock) { $lock.Dispose() } }
    }
}

Start-Station (Join-Path (Split-Path $PSScriptRoot -Parent) 'watchdog')
