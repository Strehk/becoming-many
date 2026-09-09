# Purpose: Manually move dynamic TCP allocation above PICO's fixed port 49667.
# Context: Windows PowerShell 5.1; run once as administrator, then restart Windows.
# Evidence: https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcp-ip-port-exhaustion-troubleshooting
# EventLog: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-even6/3479d837-b759-4b13-9d5e-4c93eede7cb6
param([switch]$Restore, [switch]$Elevated)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-PortNetsh {
    param([string[]]$Arguments)
    $output = & "$env:SystemRoot\System32\netsh.exe" @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "netsh failed ($LASTEXITCODE): $($output -join ' ')" }
    return $output
}

function Get-TcpRange {
    param([string]$Family)
    $output = Invoke-PortNetsh @('interface', $Family, 'show', 'dynamicport', 'tcp')
    # Labels are localized; the two numeric fields are start and count.
    $numbers = @($output | ForEach-Object {
        if ($_ -match '^\s*[^:]+:\s*(\d+)\s*$') { [int]$Matches[1] }
    })
    if ($numbers.Count -ne 2) { throw "Cannot read the $Family TCP dynamic range." }
    return [pscustomobject]@{ Start = $numbers[0]; Count = $numbers[1] }
}

function Test-TcpRange {
    param($Range, [int]$Start, [int]$Count)
    return $Range.Start -eq $Start -and $Range.Count -eq $Count
}

function Set-TcpRange {
    param([string]$Family, $Range)
    $null = Invoke-PortNetsh @('interface', $Family, 'set', 'dynamicport', 'tcp', "start=$($Range.Start)", "num=$($Range.Count)")
    if (!(Test-TcpRange (Get-TcpRange $Family) $Range.Start $Range.Count)) {
        throw "$Family TCP range readback does not match the requested settings."
    }
}

function Assert-NoRpcPortPolicy {
    # Read the parent so a missing key is distinct from an unreadable registry.
    $rpc = Get-Item -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Rpc' -ErrorAction Stop
    try {
        if ($rpc.GetSubKeyNames() -contains 'Internet') {
            throw 'Existing RPC Internet configuration requires individual review; no settings changed.'
        }
    } finally { $rpc.Close() }
}

function Get-PicoPortOwner {
    $owners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq 49667 } |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if (!$owners.Count) { return 'free' }
    if ($owners.Count -ne 1) { throw 'Port 49667 has multiple owners; no settings changed.' }
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($owners[0])" -OperationTimeoutSec 10 -ErrorAction Stop
    if ($owner -and $owner.Name -in @('Business Streaming.exe', 'BusinessStreaming.exe')) { return 'pico' }
    $services = @(Get-CimInstance Win32_Service -Filter "ProcessId=$($owners[0])" -OperationTimeoutSec 10 -ErrorAction Stop)
    if ($owner -and $owner.Name -eq 'svchost.exe' -and $services.Count -eq 1 -and $services[0].Name -eq 'EventLog') {
        return 'eventlog'
    }
    throw "Port 49667 belongs to an unrecognized process (PID $($owners[0])); no settings changed."
}

function Invoke-PicoPortRepair {
    param([string]$BackupPath, [switch]$Restore)
    $families = @('ipv4', 'ipv6')
    $target = [pscustomobject]@{ Start = 50000; Count = 15536 }
    $baseline = [pscustomobject]@{ Start = 49152; Count = 16384 }
    [void][IO.Directory]::CreateDirectory((Split-Path $BackupPath -Parent))
    $lock = [IO.File]::Open("$BackupPath.lock", 'OpenOrCreate', 'ReadWrite', 'None')
    try {
        Assert-NoRpcPortPolicy
        $machine = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
        if ([string]::IsNullOrWhiteSpace($machine)) { throw 'Cannot identify this Windows installation.' }
        $original = @{ ipv4 = Get-TcpRange 'ipv4'; ipv6 = Get-TcpRange 'ipv6' }
        if (Test-Path -LiteralPath $BackupPath) {
            $backup = Import-Clixml -LiteralPath $BackupPath -ErrorAction Stop
            if ($backup.Version -ne 1 -or $backup.MachineGuid -ne $machine) { throw 'Backup belongs to another Windows installation or format.' }
            foreach ($family in $families) {
                if (!(Test-TcpRange $backup.$family $baseline.Start $baseline.Count)) { throw 'Backup does not contain the expected original TCP ranges.' }
                if (!(Test-TcpRange $original[$family] $baseline.Start $baseline.Count) -and
                    !(Test-TcpRange $original[$family] $target.Start $target.Count)) {
                    throw "Unexpected external $family TCP range change; refusing to overwrite it."
                }
            }
        } else {
            if ($Restore) { throw 'No saved TCP range backup exists.' }
            foreach ($family in $families) {
                if (!(Test-TcpRange $original[$family] $baseline.Start $baseline.Count)) {
                    throw "Custom $family TCP range requires individual review; no settings changed."
                }
            }
        }
        if (!$Restore) {
            $owner = Get-PicoPortOwner
            if ($owner -eq 'pico') {
                Write-Host 'PICO already owns TCP port 49667. There is no current port conflict; no settings changed.'
                return
            }
            if (!(Test-Path -LiteralPath $BackupPath)) {
                $backup = [pscustomobject]@{ Version = 1; MachineGuid = $machine; ipv4 = $original.ipv4; ipv6 = $original.ipv6 }
                # Exclusive create preserves the first baseline even after a failed/repeated repair.
                $stream = [IO.File]::Open($BackupPath, 'CreateNew', 'Write', 'None')
                try {
                    $bytes = [Text.Encoding]::UTF8.GetBytes([Management.Automation.PSSerializer]::Serialize($backup))
                    $stream.Write($bytes, 0, $bytes.Length)
                    $stream.Flush($true)
                } finally { $stream.Dispose() }
            }
        }
        $changed = New-Object 'Collections.Generic.List[string]'
        try {
            foreach ($family in $families) {
                $desired = if ($Restore) { $backup.$family } else { $target }
                if (Test-TcpRange $original[$family] $desired.Start $desired.Count) { continue }
                # Include a command whose readback fails: it may already have changed Windows.
                $changed.Add($family)
                Set-TcpRange $family $desired
            }
        } catch {
            $failure = $_.Exception.Message
            foreach ($family in $changed) {
                try { Set-TcpRange $family $original[$family] }
                catch { $failure += " Rollback failed for ${family}: $($_.Exception.Message)" }
            }
            throw $failure
        }
        if ($Restore) { Write-Host 'Saved IPv4 and IPv6 TCP ranges restored.' }
        else { Write-Host 'IPv4 and IPv6 dynamic TCP range: 50000-65535 (15536 ports; 848 fewer than default).' }
        Write-Host 'Restart Windows to release existing listeners and verify that PICO can own TCP port 49667.'
        Write-Host "Backup retained at: $BackupPath"
    } finally { $lock.Dispose() }
}

$exitCode = 0
$transcribing = $false
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try { $administrator = (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
    finally { $identity.Dispose() }
    if (!$administrator) {
        if ($Elevated) { throw 'Administrator privileges were not granted.' }
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Elevated'
        if ($Restore) { $arguments += ' -Restore' }
        $child = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
        exit $child.ExitCode
    }
    $project = Split-Path $PSScriptRoot -Parent
    $logDirectory = Join-Path $project 'watchdog\logs'
    [void][IO.Directory]::CreateDirectory($logDirectory)
    Start-Transcript -Path (Join-Path $logDirectory 'pico-port-repair.log') -Force | Out-Null
    $transcribing = $true
    $backupPath = Join-Path $project 'watchdog\run\pico-port-backup.clixml'
    Invoke-PicoPortRepair -BackupPath $backupPath -Restore:$Restore
} catch {
    Write-Host "PICO port repair failed: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
} finally {
    if ($transcribing) { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null }
}
[void](Read-Host 'Press Enter to close')
exit $exitCode
