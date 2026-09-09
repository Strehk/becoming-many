# Purpose: Collect a bounded, read-only Windows station diagnostic report.
# Boundary: No process termination, service changes, port reservations or configuration writes.
param([string]$StationRoot = (Split-Path $PSScriptRoot -Parent), [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$streamPort = 49667
$summary = New-Object 'Collections.Generic.List[string]'
$details = New-Object 'Collections.Generic.List[string]'

function Read-NativeDiagnostic {
    param([string]$File, [string]$Arguments)
    $process = New-Object Diagnostics.Process
    $process.StartInfo = New-Object Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $File
    $process.StartInfo.Arguments = $Arguments
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.WorkingDirectory = $StationRoot
    try {
        [void]$process.Start()
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (!$process.WaitForExit(10000)) {
            # This is only the diagnostic child we just started, never a station service.
            $process.Kill()
            throw "$File diagnostic timed out after 10 seconds"
        }
        $text = ($output.GetAwaiter().GetResult() + $errors.GetAwaiter().GetResult()).Trim()
        if ($text.Length -gt 16000) { $text = $text.Substring(0, 16000) + "`n[truncated]" }
        if ($process.ExitCode -ne 0) { return "Unavailable (exit $($process.ExitCode)): $text" }
        return $text
    } catch { return "Unavailable: $($_.Exception.Message)" }
    finally { $process.Dispose() }
}

function Add-Detail {
    param([string]$Title, [object]$Content)
    $details.Add("`n--- $Title ---")
    $text = ($Content | Out-String -Width 160).Trim()
    if ($text.Length -gt 16000) { $text = $text.Substring(0, 16000) + "`n[truncated]" }
    $details.Add($text)
}

Write-Host 'Finding station problems. Please wait; no station settings will change.'
$processes = @()
try { $processes = @(Get-CimInstance Win32_Process -OperationTimeoutSec 10) }
catch { $summary.Add("[CHECK] Process inspection unavailable: $($_.Exception.Message)") }

try {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $streamPort })
    if (!$listeners.Count) { $summary.Add("[CHECK] PICO port ${streamPort}: no TCP listener.") }
    foreach ($ownerId in @($listeners.OwningProcess | Sort-Object -Unique)) {
        $owner = $processes | Where-Object { $_.ProcessId -eq $ownerId } | Select-Object -First 1
        $name = if ($owner) { $owner.Name } else { 'unknown process' }
        $summary.Add("[INFO] PICO port ${streamPort}: PID $ownerId ($name).")
        try {
            $services = @(Get-CimInstance Win32_Service -Filter "ProcessId = $ownerId" -OperationTimeoutSec 10)
            if ($services.Count) {
                $summary.Add('[INFO] Port owner services: ' + (($services.Name) -join ', '))
                Add-Detail 'Port owner services' ($services | Select-Object Name, DisplayName, State, ProcessId, PathName | Format-List)
            }
        } catch { Add-Detail 'Port owner services' $_.Exception.Message }
        if ($owner) { Add-Detail 'Streaming port owner' ($owner | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine | Format-List) }
    }
    Add-Detail 'TCP listeners on streaming port' ($listeners | Format-Table LocalAddress, LocalPort, OwningProcess)
} catch { $summary.Add("[CHECK] TCP inspection unavailable: $($_.Exception.Message)") }

try {
    $udp = @(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -in @(2346,2347,2348,2349,2350,$streamPort) })
    Add-Detail 'Watchdog control ports and streaming UDP' ($udp | Format-Table LocalAddress, LocalPort, OwningProcess)
    $summary.Add('[INFO] Watchdog UDP ports present: ' + (($udp.LocalPort | Sort-Object -Unique) -join ', '))
} catch { $summary.Add("[CHECK] UDP inspection unavailable: $($_.Exception.Message)") }

foreach ($protocol in @('tcp','udp')) {
    $exclusions = Read-NativeDiagnostic 'netsh.exe' "interface ipv4 show excludedportrange protocol=$protocol"
    Add-Detail "Excluded $protocol ports" $exclusions
    if ($exclusions.StartsWith('Unavailable')) { $summary.Add("[CHECK] $protocol port exclusions unavailable."); continue }
    $ranges = @([regex]::Matches($exclusions, '(?m)^\s*(\d+)\s+(\d+)\s*\*?\s*$') | Where-Object {
        [int]$_.Groups[1].Value -le $streamPort -and [int]$_.Groups[2].Value -ge $streamPort
    })
    if ($ranges.Count) { $summary.Add("[CHECK] Windows excludes $protocol port $streamPort in a reserved range.") }
    else { $summary.Add("[INFO] No listed $protocol exclusion contains port $streamPort.") }
}

$related = @($processes | Where-Object { $_.Name -match '(?i)pico|business.?stream|vrserver|vrmonitor|vrcompositor|watchdog|docker' })
Add-Detail 'Streaming and supervision processes (children are not necessarily duplicates)' ($related | Select-Object -First 60 ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine | Format-List)
foreach ($app in @(@('PICO', '(?i)pico|business.?stream'), @('SteamVR', '(?i)^vrserver\.exe$'))) {
    $matches = @($processes | Where-Object { $_.Name -match $app[1] })
    $summary.Add("[INFO] $($app[0]) processes: $($matches.Count) (does not confirm headset connection).")
}
try {
    Add-Detail 'Relevant Windows startup registrations' (Get-CimInstance Win32_StartupCommand -OperationTimeoutSec 10 | Where-Object { $_.Command -match '(?i)pico|business.?stream|steam|watchdog|start-station|docker' } | Select-Object -First 30 Name, Command, Location | Format-List)
} catch { Add-Detail 'Windows startup registrations' $_.Exception.Message }
foreach ($startupFolder in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
    if (!$startupFolder) { continue }
    try {
        Add-Detail "Startup folder: $startupFolder" (Get-ChildItem -LiteralPath $startupFolder | Select-Object -First 30 Name, FullName, LinkType, Target | Format-List)
        $shell = New-Object -ComObject WScript.Shell
        try {
            foreach ($shortcut in @(Get-ChildItem -LiteralPath $startupFolder -Filter '*.lnk' | Select-Object -First 30)) {
                $link = $shell.CreateShortcut($shortcut.FullName)
                Add-Detail $shortcut.Name ($link | Select-Object TargetPath, Arguments, WorkingDirectory | Format-List)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($link)
            }
        } finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
    } catch { Add-Detail 'Startup folder inspection' $_.Exception.Message }
}
try {
    Add-Detail 'Relevant scheduled tasks' (Get-ScheduledTask -ErrorAction Stop | Where-Object {
        ($_.TaskName + ' ' + ($_.Actions | Out-String)) -match '(?i)pico|business.?stream|steam|watchdog|start-station'
    } | Select-Object -First 30 TaskName, TaskPath, State, Actions | Format-List)
} catch { Add-Detail 'Scheduled task inspection' $_.Exception.Message }
Add-Detail 'Legacy Watchdog location' ("C:\Watchdog exists: " + (Test-Path -LiteralPath 'C:\Watchdog'))
try { Add-Detail 'Virtual networking services' (Get-Service -Name hns, winnat -ErrorAction Stop | Format-Table Name, Status) }
catch { Add-Detail 'Virtual networking services' $_.Exception.Message }

$branch = Read-NativeDiagnostic 'git.exe' 'branch --show-current'
$commit = Read-NativeDiagnostic 'git.exe' 'rev-parse --short HEAD'
$summary.Add("[INFO] Checkout: $branch / $commit")
Add-Detail 'Working tree' (Read-NativeDiagnostic 'git.exe' 'status --short')
Add-Detail 'Docker containers' (Read-NativeDiagnostic 'docker.exe' 'ps --format "{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}"')
try {
    $health = Invoke-WebRequest 'http://localhost/health' -UseBasicParsing -TimeoutSec 5
    $summary.Add("[INFO] Station HTTP: $($health.StatusCode) (does not confirm VR streaming).")
} catch { $summary.Add('[CHECK] Station http://localhost/health is unavailable.') }
foreach ($logName in @('pico.log','steamvr.log','kiosk.log','startup.log')) {
    $logPath = Join-Path $StationRoot "watchdog/logs/$logName"
    if (Test-Path -LiteralPath $logPath) {
        try { Add-Detail $logName (Get-Content -LiteralPath $logPath -Tail 60) }
        catch { Add-Detail $logName $_.Exception.Message }
    }
}
$summary.Add('[NEXT] Photograph this summary and the Streaming port owner section.')
$summary.Add('[NOTE] No headset connection is certified by a process or port check.')
$heading = "BECOMING MANY - FIND PROBLEMS`r`n$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') / $env:COMPUTERNAME"
$report = $heading + "`r`n`r`n" + ($summary -join "`r`n") + "`r`n" + ($details -join "`r`n")
$directory = Join-Path $StationRoot 'watchdog/logs'
[void][IO.Directory]::CreateDirectory($directory)
$reportPath = Join-Path $directory 'find-problems.txt'
[IO.File]::WriteAllText($reportPath, $report, (New-Object Text.UTF8Encoding($true)))
Write-Host "`n$heading`n"
foreach ($line in $summary) { Write-Host $line }
Write-Host "`nReport: $reportPath"
if (!$NoOpen) {
    try { Start-Process notepad.exe -ArgumentList ('"' + $reportPath + '"') | Out-Null }
    catch { Write-Warning 'Could not open Notepad. The report is saved at the path above.' }
}
