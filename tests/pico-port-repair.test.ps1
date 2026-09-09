# Purpose: Verify reversible PICO port repair without modifying Windows networking.
# Context: AST-load functions only; replace Windows boundaries, keep real backup files.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null
$errors = $null
$source = Get-Content (Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/repair-pico-port.ps1') -Raw
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
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('pico-port-repair-' + [guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($temporary)
try {
    foreach ($case in @('repeat-restore', 'partial-failure', 'readback-failure', 'custom-range', 'rpc-policy', 'registry-error', 'unknown-owner', 'pico-owner', 'free-port', 'wrong-host', 'external-change', 'tracked-partial', 'missing-backup')) {
        & {
            $backupPath = Join-Path $temporary "$case.clixml"
            $script:ranges = @{
                ipv4 = [pscustomobject]@{ Start = 49152; Count = 16384 }
                ipv6 = [pscustomobject]@{ Start = 49152; Count = 16384 }
            }
            $script:changes = New-Object 'Collections.Generic.List[string]'
            $script:machineGuid = 'test-windows-installation'
            $script:registryReadCount = 0
            $script:failedOnce = $false
            $script:malformedReadback = $false
            if ($case -eq 'custom-range') { $script:ranges.ipv6.Start = 51000 }
            function Get-Item {
                param($LiteralPath, $ErrorAction)
                $script:registryReadCount++
                if ($case -eq 'registry-error') { throw 'registry access denied' }
                $registry = [pscustomobject]@{ HasPolicy = ($case -eq 'rpc-policy') }
                $registry | Add-Member ScriptMethod GetSubKeyNames { if ($this.HasPolicy) { 'Internet' } }
                $registry | Add-Member ScriptMethod Close {}
                return $registry
            }
            function Get-ItemProperty {
                param($LiteralPath, $Name, $ErrorAction)
                return [pscustomobject]@{ MachineGuid = $script:machineGuid }
            }
            function Get-NetTCPConnection {
                param($State, $ErrorAction)
                if ($case -eq 'free-port') { return }
                # IPv4 and IPv6 listeners owned by the same EventLog process.
                [pscustomobject]@{ LocalPort = 49667; OwningProcess = 3728 }
                [pscustomobject]@{ LocalPort = 49667; OwningProcess = 3728 }
            }
            function Get-CimInstance {
                param($ClassName, $Filter, $OperationTimeoutSec, $ErrorAction)
                Assert-True ($OperationTimeoutSec -eq 10) 'CIM owner lookup must have a bounded timeout.'
                if ($ClassName -eq 'Win32_Service') { return [pscustomobject]@{ Name = 'EventLog' } }
                $name = switch ($case) {
                    'unknown-owner' { 'unknown.exe' }
                    'pico-owner' { 'Business Streaming.exe' }
                    default { 'svchost.exe' }
                }
                return [pscustomobject]@{ Name = $name }
            }
            function Invoke-PortNetsh {
                param([string[]]$Arguments)
                Assert-True ($Arguments[4] -eq 'tcp') 'Repair touched another transport.'
                $family = $Arguments[1]
                if ($Arguments[2] -eq 'show') {
                    if ($script:malformedReadback) {
                        $script:malformedReadback = $false
                        return 'unreadable range output'
                    }
                    return @("Startport : $($script:ranges[$family].Start)", "Anzahl der Ports : $($script:ranges[$family].Count)")
                }
                $script:changes.Add($family)
                $script:ranges[$family] = [pscustomobject]@{
                    Start = [int]($Arguments[5] -replace '^start=', '')
                    Count = [int]($Arguments[6] -replace '^num=', '')
                }
                if ($family -eq 'ipv6' -and !$script:failedOnce -and $case -in @('partial-failure', 'readback-failure')) {
                    $script:failedOnce = $true
                    if ($case -eq 'partial-failure') { throw 'injected netsh failure after mutation' }
                    $script:malformedReadback = $true
                }
            }
            $repair = { Invoke-PicoPortRepair -BackupPath $backupPath }
            switch ($case) {
                'custom-range' { Assert-Throws $repair 'Custom ipv6' }
                'rpc-policy' { Assert-Throws $repair 'Existing RPC Internet' }
                'registry-error' { Assert-Throws $repair 'registry access denied' }
                'unknown-owner' { Assert-Throws $repair 'unrecognized process' }
                'missing-backup' { Assert-Throws { Invoke-PicoPortRepair $backupPath -Restore } 'No saved' }
                'partial-failure' { Assert-Throws $repair 'injected netsh failure' }
                'readback-failure' { Assert-Throws $repair 'Cannot read' }
                default { & $repair }
            }
            if ($case -in @('partial-failure', 'readback-failure')) {
                foreach ($family in @('ipv4', 'ipv6')) {
                    Assert-True (Test-TcpRange $script:ranges[$family] 49152 16384) 'Partial failure left a modified range.'
                }
                Assert-True ($script:changes.Count -eq 4) 'Both attempted mutations must be rolled back.'
                $saved = [IO.File]::ReadAllText($backupPath)
                & $repair
                Assert-True ([IO.File]::ReadAllText($backupPath) -ceq $saved) 'Retry overwrote the original baseline.'
            } elseif ($case -in @('custom-range', 'rpc-policy', 'registry-error', 'unknown-owner', 'pico-owner', 'missing-backup')) {
                Assert-True ($script:changes.Count -eq 0) 'Refused repair changed Windows.'
                Assert-True (!(Test-Path -LiteralPath $backupPath)) 'Refused repair created a baseline.'
            } else {
                Assert-True ($script:changes.Count -eq 2) 'Initial repair did not set both TCP families.'
                $saved = [IO.File]::ReadAllText($backupPath)
                if ($case -eq 'repeat-restore') {
                    $lock = [IO.File]::Open("$backupPath.lock", 'OpenOrCreate', 'ReadWrite', 'None')
                    try { Assert-Throws { Invoke-PicoPortRepair $backupPath -Restore } '*' }
                    finally { $lock.Dispose() }
                    Assert-True ($script:registryReadCount -eq 1) 'Concurrent invocation read state before acquiring its lock.'
                    Assert-True ($script:changes.Count -eq 2) 'Concurrent invocation changed Windows.'
                    Assert-True ([IO.File]::ReadAllText($backupPath) -ceq $saved) 'Concurrent invocation damaged the baseline.'
                }
                if ($case -eq 'wrong-host') {
                    $script:machineGuid = 'different-windows-installation'
                    Assert-Throws { Invoke-PicoPortRepair $backupPath -Restore } 'another Windows installation'
                    Assert-Throws $repair 'another Windows installation'
                    Assert-True ($script:changes.Count -eq 2) 'Host mismatch modified Windows.'
                } elseif ($case -eq 'external-change') {
                    $script:ranges.ipv4 = [pscustomobject]@{ Start = 51000; Count = 14536 }
                    Assert-Throws { Invoke-PicoPortRepair $backupPath -Restore } 'Unexpected external'
                    Assert-Throws $repair 'Unexpected external'
                    Assert-True ($script:changes.Count -eq 2) 'External settings were overwritten.'
                } else {
                    if ($case -eq 'tracked-partial') {
                        $script:ranges.ipv6 = [pscustomobject]@{ Start = 49152; Count = 16384 }
                    }
                    & $repair
                    $expected = if ($case -eq 'tracked-partial') { 3 } else { 2 }
                    Assert-True ($script:changes.Count -eq $expected) 'Repeat did not preserve an already applied range.'
                    Invoke-PicoPortRepair $backupPath -Restore
                    foreach ($family in @('ipv4', 'ipv6')) {
                        Assert-True (Test-TcpRange $script:ranges[$family] 49152 16384) 'Restore lost the saved range.'
                    }
                    Invoke-PicoPortRepair $backupPath -Restore
                    Assert-True ($script:changes.Count -eq ($expected + 2)) 'Repeated restore changed an original range.'
                }
                Assert-True ([IO.File]::ReadAllText($backupPath) -ceq $saved) 'Original backup was overwritten.'
            }
            Write-Host "PASS PICO port repair '$case'"
        }
    }
} finally { [IO.Directory]::Delete($temporary, $true) }
