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
    foreach ($case in @('fresh', 'multiple-owners', 'owner', 'other-config', 'udp-conflict', 'pico-conflict', 'external', 'timeout', 'startup-race')) {
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
                if ($script:launchedCount -and $case -ne 'timeout') {
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
                [pscustomobject]@{ Id = 40 }
            }
            function Start-Sleep { param($Seconds) $script:waitCount++ }
            $action = { Start-StationWatchdog 'pico' 2347 $temporary }
            switch ($case) {
                'multiple-owners' { Assert-Throws $action 'Multiple pico Watchdogs' }
                'udp-conflict' { Assert-Throws $action 'unrecognized PID 99' }
                'pico-conflict' { Assert-Throws $action 'PID 3672' }
                'timeout' { Assert-Throws $action 'within 10 seconds' }
                'startup-race' { Assert-Throws $action 'another process took control port' }
                default { & $action }
            }
            $expected = if ($case -in @('fresh', 'other-config', 'timeout', 'startup-race')) { 1 } else { 0 }
            Assert-True ($script:launchedCount -eq $expected) "Unexpected launches for $case."
            if ($case -eq 'timeout') { Assert-True ($script:waitCount -eq 10) 'Startup wait is not bounded.' }
            Write-Host "PASS startup '$case'"
        }
    }
    foreach ($failed in @($false, $true)) {
        & {
            $events = New-Object 'Collections.Generic.List[string]'
            function Test-Path { param($LiteralPath, $PathType) return $true }
            function Start-StationWatchdog {
                param($Name, $Port, $WatchdogDirectory)
                $events.Add($Name)
                if ($failed -and $Name -eq 'pico') { throw 'injected failure' }
            }
            function Start-Sleep { param($Seconds) $events.Add("wait:$Seconds") }
            if ($failed) { Assert-Throws { Start-Station $temporary } 'injected failure' }
            else {
                Start-Station $temporary
                Assert-True (($events -join ',') -eq 'docker,pico,station,wait:30,steamvr,wait:15,kiosk') 'Startup order changed.'
            }
            $released = Open-StartupLock (Join-Path $temporary 'run')
            $released.Dispose()
        }
    }
    Write-Host 'PASS startup order, bounded readiness and lock cleanup'
} finally { [IO.Directory]::Delete($temporary, $true) }
