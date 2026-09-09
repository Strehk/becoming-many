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
        $profiles = @((Join-Path $WatchdogDirectory 'run\kiosk-station'))
        if ($env:LOCALAPPDATA) { $profiles += Join-Path $env:LOCALAPPDATA 'becoming-many\kiosk-station' }
        $profilePattern = '(?i)(?:^|[\s"])--user-data-dir="?(?:' +
            (($profiles | ForEach-Object { [regex]::Escape($_.Replace('/', '\')) }) -join '|') + ')(?:$|[\s"])'
        return [bool]@($Processes | Where-Object {
            $_.Name -in @('chrome.exe', 'chromium.exe', 'msedge.exe') -and $_.CommandLine -and
                $_.CommandLine.Replace('/', '\') -match $profilePattern
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
    # CIM does not expose another process's working directory. A relative config
    # cannot establish ownership, but starting again could create a duplicate.
    $relativePattern = '(?i)(?:^|[\s"])(?:\.\\)?' + [regex]::Escape("$Name.yaml") + '(?:$|[\s"])'
    $relativeOwners = @($processes | Where-Object {
        $_.Name -eq 'Watchdog.exe' -and $_.CommandLine -and
            $_.CommandLine.Replace('/', '\') -match $relativePattern
    })
    if ($relativeOwners.Count) {
        Write-Warning "SKIPPED ${Name}: Watchdog uses a relative config (PID $($relativeOwners.ProcessId -join ', ')). Ownership is unverified; no additional instance was launched. Run scripts\find-problems.bat."
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
            $portOwners = @($picoListeners.OwningProcess | Sort-Object -Unique)
            throw "Cannot start pico: port 49667 already belongs to PID $($portOwners -join ', '). Run scripts\find-problems.bat."
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
    if ($launched.HasExited) {
        throw "${Name}: Watchdog exited before control port $Port became available. See watchdog/logs/$Name.log."
    }
    Write-Warning "${Name}: Watchdog process started, but control port $Port is not ready after 10 seconds. Startup hooks may still be waiting; check watchdog/logs/$Name.log."
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
        $failures = New-Object 'Collections.Generic.List[string]'
        $components = @(
            @{ Name = 'docker'; Port = 2348; Delay = 0 }
            @{ Name = 'pico'; Port = 2347; Delay = 0 }
            @{ Name = 'station'; Port = 2349; Delay = 0 }
            @{ Name = 'steamvr'; Port = 2346; Delay = 30 }
            @{ Name = 'kiosk'; Port = 2350; Delay = 15 }
        )
        foreach ($component in $components) {
            if ($component.Delay) {
                Write-Host "Waiting $($component.Delay)s before $($component.Name) ..."
                Start-Sleep -Seconds $component.Delay
            }
            try { Start-StationWatchdog $component.Name $component.Port $WatchdogDirectory }
            catch {
                $failures.Add("$($component.Name): $($_.Exception.Message)")
                Write-Warning $failures[$failures.Count - 1]
            }
        }
        if ($failures.Count) {
            throw ("Station startup completed with problems. All components were attempted.`n" + ($failures -join "`n"))
        }
        Write-Host "Startup checks complete. Review any SKIPPED messages. Headset connection is not verified. Logs: $WatchdogDirectory\logs"
    } finally {
        try { if ($transcribing) { Stop-Transcript | Out-Null } }
        finally { if ($null -ne $lock) { $lock.Dispose() } }
    }
}

Start-Station (Join-Path (Split-Path $PSScriptRoot -Parent) 'watchdog')
