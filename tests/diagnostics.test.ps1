# Purpose: Exercise the real diagnostic collector with isolated Windows boundaries.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$source = Get-Content (Join-Path $project 'scripts/find-problems.ps1') -Raw
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) {
        . ([scriptblock]::Create($statement.Extent.Text))
    }
}
$body = [scriptblock]::Create(($ast.EndBlock.Statements | Where-Object {
    $_ -isnot [Management.Automation.Language.FunctionDefinitionAst]
} | ForEach-Object { $_.Extent.Text }) -join "`n")
function Assert-Contains { param($Text,$Expected) if (!$Text.Contains($Expected)) { throw "Missing: $Expected" } }
$StationRoot = Join-Path ([IO.Path]::GetTempPath()) ('station-diagnostic-' + [guid]::NewGuid())
$NoOpen = $true
[void][IO.Directory]::CreateDirectory($StationRoot)
try {
    $logDirectory = Join-Path $StationRoot 'watchdog/logs'
    [void][IO.Directory]::CreateDirectory($logDirectory)
    [IO.File]::WriteAllText((Join-Path $logDirectory 'docker.log'), 'Docker engine startup failed')
    [IO.File]::WriteAllText((Join-Path $logDirectory 'station.log'), 'Station compose bring-up failed')
    function Get-CimInstance {
        param($ClassName,$Filter,$OperationTimeoutSec)
        if ($ClassName -eq 'Win32_Process') {
            [pscustomobject]@{ Name='svchost.exe'; ProcessId=3672; ParentProcessId=100; ExecutablePath='C:\Windows\System32\svchost.exe'; CommandLine='svchost.exe -k test' }
        } elseif ($ClassName -eq 'Win32_Service') {
            [pscustomobject]@{ Name='ExampleService'; DisplayName='Example service'; State='Running'; ProcessId=3672; PathName='svchost.exe -k test' }
        }
    }
    function Get-NetTCPConnection {
        param($State,$ErrorAction)
        [pscustomobject]@{ LocalAddress='0.0.0.0'; LocalPort=49667; OwningProcess=3672 }
        [pscustomobject]@{ LocalAddress='::'; LocalPort=49667; OwningProcess=3672 }
    }
    function Get-NetUDPEndpoint { param($ErrorAction) [pscustomobject]@{ LocalAddress='0.0.0.0'; LocalPort=2347; OwningProcess=20 } }
    function Get-Service { param($Name,$ErrorAction) throw 'Service inspection unavailable' }
    function Invoke-WebRequest { param($Uri,[switch]$UseBasicParsing,$TimeoutSec) [pscustomobject]@{StatusCode=200} }
    function Read-NativeDiagnostic {
        param($File,$Arguments)
        switch ($File) {
            'netsh.exe' {
                if ($Arguments -like '*show dynamicport*') { return "Startport : 49152`nAnzahl der Ports : 16384" }
                return "Start Port End Port`n 49600 49699 *"
            }
            'reg.exe' { return 'Unavailable: registry key not found' }
            'git.exe' { if ($Arguments -eq 'branch --show-current') { return 'david_refactor' }; return 'abc123' }
            'docker.exe' { return 'Unavailable: Docker offline' }
        }
    }
    & $body
    $path = Join-Path $StationRoot 'watchdog/logs/find-problems.txt'
    $report = Get-Content -LiteralPath $path -Raw
    Assert-Contains $report 'PID 3672 (svchost.exe)'
    if (([regex]::Matches($report,'\[INFO\] PICO port 49667:')).Count -ne 1) { throw 'IPv4/IPv6 must not duplicate owner count' }
    Assert-Contains $report 'ExampleService'
    Assert-Contains $report 'Windows excludes tcp port 49667'
    Assert-Contains $report 'Unavailable: Docker offline'
    Assert-Contains $report 'does not confirm VR streaming'
    Assert-Contains $report '[INFO] ipv4 dynamic TCP: 49152-65535'
    Assert-Contains $report '[INFO] ipv6 dynamic TCP: 49152-65535'
    Assert-Contains $report 'ActiveRuntime'
    Assert-Contains $report 'Unavailable: registry key not found'
    Assert-Contains $report 'Docker engine startup failed'
    Assert-Contains $report 'Station compose bring-up failed'
    function Get-NetTCPConnection { param($State,$ErrorAction) throw 'Access denied' }
    function Read-NativeDiagnostic { param($File,$Arguments) return 'Unavailable: not installed' }
    & $body
    $report = Get-Content -LiteralPath $path -Raw
    Assert-Contains $report 'TCP inspection unavailable: Access denied'
    Assert-Contains $report 'tcp port exclusions unavailable'
    Assert-Contains $report 'ipv4 dynamic TCP range could not be read'
    if ($report.Contains('PID 3672 (svchost.exe)')) { throw 'Report was appended instead of replaced' }
    Write-Host 'PASS diagnostic owner/service, dual-stack deduplication, exclusions, partial failure and report replacement'
} finally { [IO.Directory]::Delete($StationRoot,$true) }
