# Purpose: Check startup ownership without launching apps or changing Windows.
# Context: Run with Windows PowerShell 5.1 or pwsh; no Pester required.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = Split-Path $PSScriptRoot -Parent
$tokens = $null
$errors = $null
$source = Get-Content (Join-Path $project 'scripts/start-station.ps1') -Raw
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) {
        . ([scriptblock]::Create($statement.Extent.Text))
    }
}
function Assert-True {
    param([bool]$Value, [string]$Message)
    if (!$Value) { throw $Message }
}
function Assert-Throws {
    param([scriptblock]$Action, [string]$Pattern)
    try { & $Action } catch {
        if ($_ -like "*$Pattern*") { return }
        throw
    }
    throw "Expected failure: $Pattern"
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('station-startup-' + [guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($temporary)
try {
    $lock = Open-StartupLock $temporary
    try { Assert-Throws { Open-StartupLock $temporary } '*' } finally { $lock.Dispose() }
    $lock = Open-StartupLock $temporary
    $lock.Dispose()
    foreach ($case in @('fresh', 'multiple-owners', 'owner', 'relative-owner', 'relative-option', 'other-config', 'udp-conflict', 'pico-conflict', 'external', 'timeout', 'exited', 'startup-race')) {
        & {
            $script:launchedCount = 0
            $script:waitCount = 0
            $config = Join-Path $temporary 'pico.yaml'
            function Test-Path { param($LiteralPath, $PathType) return $true }
            function Get-CimInstance {
                param($ClassName, $ErrorAction)
                if ($case -eq 'multiple-owners') {
                    foreach ($number in 20..21) { [pscustomobject]@{ Name='Watchdog.exe'; ProcessId=$number; CommandLine='Watchdog.exe "' + $config + '"' } }
                }
                if ($case -in @('owner', 'other-config')) {
                    $ownerConfig = if ($case -eq 'owner') { $config } else { "$config.other" }
                    [pscustomobject]@{ Name = 'Watchdog.exe'; ProcessId = 20; CommandLine = 'Watchdog.exe "' + $ownerConfig + '"' }
                }
                if ($case -in @('relative-owner', 'relative-option')) {
                    $arguments = if ($case -eq 'relative-owner') { 'pico.yaml' } else { '--configfile ".\PICO.yaml"' }
                    [pscustomobject]@{ Name = 'Watchdog.exe'; ProcessId = 20; CommandLine = 'Watchdog.exe ' + $arguments }
                }
                if ($case -eq 'external') {
                    # Multiple Electron children are one running application, not proof of duplicates.
                    foreach ($processNumber in 21..23) {
                        [pscustomobject]@{ Name = 'Business Streaming.exe'; ProcessId = $processNumber; CommandLine = 'Business Streaming.exe --type=renderer' }
                    }
                }
            }
            function Get-NetUDPEndpoint {
                param($ErrorAction)
                if ($case -eq 'udp-conflict') { [pscustomobject]@{ LocalPort = 2347; OwningProcess = 99 } }
                if ($script:launchedCount -and $case -notin @('timeout', 'exited')) {
                    $owner = if ($case -eq 'startup-race') { 99 } else { 40 }
                    [pscustomobject]@{ LocalPort = 2347; OwningProcess = $owner }
                }
            }
            function Get-NetTCPConnection {
                param($State, $ErrorAction)
                if ($case -eq 'pico-conflict') { [pscustomobject]@{ LocalPort = 49667; OwningProcess = 3672 } }
            }
            function Start-Process {
                param($FilePath, $ArgumentList, $WorkingDirectory, $WindowStyle, [switch]$PassThru)
                $script:launchedCount++
                Assert-True ($ArgumentList -eq ('"' + $config + '"')) 'Config argument lost quoting.'
                [pscustomobject]@{ Id = 40; HasExited = ($case -eq 'exited') }
            }
            function Start-Sleep { param($Seconds) $script:waitCount++ }
            $action = { Start-StationWatchdog 'pico' 2347 $temporary }
            switch ($case) {
                'multiple-owners' { Assert-Throws $action 'Multiple pico Watchdogs' }
                'udp-conflict' { Assert-Throws $action 'unrecognized PID 99' }
                'pico-conflict' { Assert-Throws $action 'PID 3672' }
                'exited' { Assert-Throws $action 'exited before control port' }
                'startup-race' { Assert-Throws $action 'another process took control port' }
                default { & $action }
            }
            $expected = if ($case -in @('fresh', 'other-config', 'timeout', 'exited', 'startup-race')) { 1 } else { 0 }
            Assert-True ($script:launchedCount -eq $expected) "Unexpected launches for $case."
            if ($case -eq 'timeout') { Assert-True ($script:waitCount -eq 10) 'Startup wait is not bounded.' }
            Write-Host "PASS startup '$case'"
        }
    }
    $savedLocalAppData = $env:LOCALAPPDATA
    try {
        $env:LOCALAPPDATA = Join-Path $temporary 'LocalAppData'
        $watchdogProfile = (Join-Path $temporary 'run\kiosk-station').Replace('/', '\')
        $manualProfile = (Join-Path $env:LOCALAPPDATA 'becoming-many\kiosk-station').Replace('/', '\')
        foreach ($browser in @('chrome.exe', 'chromium.exe', 'msedge.exe')) {
            foreach ($argument in @(
                '--user-data-dir=' + $watchdogProfile
                '--user-data-dir="' + $watchdogProfile.ToUpperInvariant() + '"'
                '"--user-data-dir=' + $manualProfile + '"'
                '--user-data-dir="' + $manualProfile + '"'
            )) {
                $process = [pscustomobject]@{ Name = $browser; CommandLine = "$browser $argument --app=http://localhost/conductor.html" }
                Assert-True (Test-ApplicationRunning 'kiosk' @($process) $temporary) "Missed existing kiosk: $($process.CommandLine)"
            }
        }
        foreach ($argument in @('--user-data-dir=C:\personal', "--user-data-dir=${watchdogProfile}-other")) {
            $process = [pscustomobject]@{ Name = 'chrome.exe'; CommandLine = "chrome.exe $argument" }
            Assert-True (!(Test-ApplicationRunning 'kiosk' @($process) $temporary)) 'Personal browser was mistaken for the kiosk.'
        }
    } finally { $env:LOCALAPPDATA = $savedLocalAppData }
    Write-Host 'PASS known kiosk launch forms and separate personal browser'
    foreach ($failed in @('', 'docker', 'pico', 'station', 'steamvr', 'kiosk')) {
        & {
            $events = New-Object 'Collections.Generic.List[string]'
            function Test-Path { param($LiteralPath, $PathType) return $true }
            function Start-StationWatchdog {
                param($Name, $Port, $WatchdogDirectory)
                $events.Add($Name)
                if ($Name -eq $failed) { throw "injected $Name failure" }
            }
            function Start-Sleep { param($Seconds) $events.Add("wait:$Seconds") }
            if ($failed) { Assert-Throws { Start-Station $temporary } "injected $failed failure" }
            else { Start-Station $temporary }
            Assert-True (($events -join ',') -eq 'docker,pico,station,wait:30,steamvr,wait:15,kiosk') "Independent startup attempts changed after '$failed' failure."
            $released = Open-StartupLock (Join-Path $temporary 'run')
            $released.Dispose()
        }
    }
    & {
        # Exercise the photographed PICO conflict through the actual orchestration
        # and launch checks; only Windows/process boundaries are replaced.
        $script:startedComponents = New-Object 'Collections.Generic.List[string]'
        $script:controlOwners = @{}
        $script:stopCount = 0
        $ports = @{ docker = 2348; pico = 2347; station = 2349; steamvr = 2346; kiosk = 2350 }
        function Test-Path { param($LiteralPath, $PathType) return $true }
        function Get-CimInstance { param($ClassName, $ErrorAction) }
        function Get-NetTCPConnection {
            param($State, $ErrorAction)
            [pscustomobject]@{ LocalPort = 49667; OwningProcess = 3728 }
        }
        function Get-NetUDPEndpoint {
            param($ErrorAction)
            foreach ($port in $script:controlOwners.Keys) {
                [pscustomobject]@{ LocalPort = $port; OwningProcess = $script:controlOwners[$port] }
            }
        }
        function Start-Process {
            param($FilePath, $ArgumentList, $WorkingDirectory, $WindowStyle, [switch]$PassThru)
            $name = [IO.Path]::GetFileNameWithoutExtension($ArgumentList.Trim('"'))
            $script:startedComponents.Add($name)
            $owner = 40 + $script:startedComponents.Count
            $script:controlOwners[$ports[$name]] = $owner
            [pscustomobject]@{ Id = $owner }
        }
        function Start-Sleep { param($Seconds) }
        function Stop-Process { $script:stopCount++; throw 'Must not stop a process.' }
        function Stop-Service { $script:stopCount++; throw 'Must not stop a service.' }
        Assert-Throws { Start-Station $temporary } 'port 49667 already belongs to PID 3728'
        Assert-True (($script:startedComponents -join ',') -eq 'docker,station,steamvr,kiosk') 'PICO conflict blocked an independent component.'
        Assert-True ($script:stopCount -eq 0) 'Startup tried to stop an existing owner.'
        # A retry must retain each owner even before its supervised app appears.
        function Get-CimInstance {
            param($ClassName, $ErrorAction)
            foreach ($name in $script:startedComponents) {
                [pscustomobject]@{ Name = 'Watchdog.exe'; ProcessId = $script:controlOwners[$ports[$name]]; CommandLine = 'Watchdog.exe "' + (Join-Path $temporary "$name.yaml") + '"' }
            }
        }
        Assert-Throws { Start-Station $temporary } 'port 49667 already belongs to PID 3728'
        Assert-True ($script:startedComponents.Count -eq 4) 'Retry launched a duplicate Watchdog.'
        $released = Open-StartupLock (Join-Path $temporary 'run')
        $released.Dispose()
    }
    Write-Host 'PASS PICO system-port conflict, independent startup and retry'
    Write-Host 'PASS startup order, bounded readiness and lock cleanup'
} finally { [IO.Directory]::Delete($temporary, $true) }
