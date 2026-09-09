# Purpose: Share station deployment checks and the reboot-safe Compose launcher.
# Context: Windows PowerShell 5.1; Git, Docker and installed Watchdogs are required.
# Boundary: Local state lives in .git; this helper never writes station .env.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:StationRoot = 'C:\becoming-many'
$script:ReleaseImage = 'ghcr.io/strehk/becoming-many:latest'

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}

function Initialize-Station {
    Set-Location -LiteralPath $script:StationRoot
    $root = Invoke-Checked git @('rev-parse', '--show-toplevel')
    if ([IO.Path]::GetFullPath($root) -ne $script:StationRoot) { throw 'Wrong repository root.' }
    $script:StatePath = Join-Path $script:StationRoot '.git\station-deployment.json'
    if (!(Test-Path -LiteralPath '.git' -PathType Container)) { throw 'A regular clone is required.' }
    if (!(Test-Path -LiteralPath '.env' -PathType Leaf)) { throw 'Missing station .env.' }
    if (Invoke-Checked git @('ls-files', '--', ':(icase).env')) { throw '.env must never be tracked.' }
}

function Assert-CleanCheckout {
    if (Invoke-Checked git @('status', '--porcelain', '--untracked-files=all')) {
        throw 'Uncommitted changes found. Commit or move them yourself before deployment.'
    }
}

function Open-DeploymentLock {
    # File sharing also excludes Watchdog hooks; a process exit releases the lock.
    return [IO.File]::Open((Join-Path $script:StationRoot '.git\station-deployment.lock'),
        [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}

function Wait-Engine {
    $deadline = (Get-Date).AddSeconds(300)
    do {
        & docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)
    throw 'Docker engine unavailable after 300 seconds. Check Docker Watchdog/Desktop.'
}

function Test-WatchdogListening {
    param([int]$Port)
    # Query Windows sockets: a missing listener differs from an unresponsive one.
    return [bool]@(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port }).Count
}

function Start-DeploymentDocker {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }
    if (Test-WatchdogListening 2348) {
        Send-WatchdogCommand 2348 'start'
        return
    }
    if (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue) { return }
    $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (!(Test-Path -LiteralPath $desktop)) { throw "Docker Desktop is not installed at $desktop." }
    Write-Host '[deployment] Starting Docker Desktop; kiosk stays closed.'
    Start-Process -FilePath $desktop | Out-Null
}

function Send-WatchdogCommand {
    param([int]$Port, [string]$Command)
    $client = New-Object Net.Sockets.UdpClient
    try {
        $client.Client.ReceiveTimeout = 5000
        $client.Connect('127.0.0.1', $Port)
        $bytes = [Text.Encoding]::ASCII.GetBytes($Command)
        [void]$client.Send($bytes, $bytes.Length)
        $peer = New-Object Net.IPEndPoint([Net.IPAddress]::Any, 0)
        $reply = [Text.Encoding]::UTF8.GetString($client.Receive([ref]$peer)).Trim()
        if (!$reply) { throw "Empty Watchdog response on $Port." }
        Write-Host "[watchdog:$Port] $Command -> $reply"
    } finally { $client.Dispose() }
}

function Get-StationProcesses {
    param([ValidateSet('kiosk', 'poller')][string]$Kind)
    $pattern = if ($Kind -eq 'kiosk') { '*--user-data-dir=C:\becoming-many\watchdog\run\kiosk-station*' }
        else { '*C:\becoming-many\watchdog\bin\poll-health.bat*' }
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like $pattern }
}

function Wait-StationProcess {
    param([string]$Kind, [bool]$Running)
    $deadline = (Get-Date).AddSeconds(90)
    do {
        if ([bool]@(Get-StationProcesses $Kind).Count -eq $Running) { return }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "$Kind did not reach running=$Running within 90 seconds."
}

function Get-ComposeArguments {
    $arguments = @('compose', '--project-directory', $script:StationRoot,
        '--env-file', (Join-Path $script:StationRoot '.env'),
        '-f', (Join-Path $script:StationRoot 'docker-compose.yml'))
    if (Test-Path -LiteralPath $script:StatePath) {
        $state = Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
        $image = $state.services.station.image
        if ($image -notmatch '^(becoming-many-local:[a-z0-9_.-]+|ghcr\.io/strehk/becoming-many@sha256:[a-f0-9]{64})$') {
            throw 'Invalid deployment state; refusing release fallback.'
        }
        $arguments += @('-f', $script:StatePath)
    }
    return $arguments
}

function Write-DeploymentState {
    param([string]$Image, [string]$Branch, [string]$Commit)
    $state = @{ services = @{ station = @{ image = $Image; pull_policy = 'never'
        labels = @{ 'org.opencontainers.image.revision' = $Commit; 'station.branch' = $Branch } } } }
    $temporary = "$script:StatePath.tmp"
    [IO.File]::WriteAllText($temporary, ($state | ConvertTo-Json -Depth 6))
    if (Test-Path -LiteralPath $script:StatePath) {
        [IO.File]::Replace($temporary, $script:StatePath, "$script:StatePath.previous")
    } else { [IO.File]::Move($temporary, $script:StatePath) }
}

function Start-StationContainer {
    param([switch]$Recreate)
    $arguments = @(Get-ComposeArguments) + @('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')
    if ($Recreate) { $arguments += '--force-recreate' }
    Invoke-Checked docker ($arguments + @('station')) | Out-Host
}

function Wait-StationHealth {
    $deadline = (Get-Date).AddSeconds(180)
    do {
        try {
            $response = Invoke-WebRequest 'http://localhost/health' -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return }
        } catch { Write-Verbose 'Station not ready yet.' }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    throw 'http://localhost/health did not return HTTP 200 within 180 seconds.'
}

function Show-DeploymentResult {
    param([string]$Branch, [string]$Commit, [string]$Image)
    $id = Invoke-Checked docker (@(Get-ComposeArguments) + @('ps', '-q', 'station'))
    if (!$id) { throw 'Station container is not running.' }
    $container = (Invoke-Checked docker @('inspect', $id) | ConvertFrom-Json)[0]
    $expected = Invoke-Checked docker @('image', 'inspect', '--format', '{{.Id}}', $Image)
    if ($container.Image -ne $expected -or !$container.State.Running) { throw 'Wrong or stopped station image.' }
    if ($container.State.Health.Status -ne 'healthy') { throw 'Container healthcheck is not healthy.' }
    Write-Host "Branch: $Branch`nCommit: $Commit`nImage: $Image"
    Write-Host "Container: $id (running, healthy)`nHealth: HTTP 200"
    if (Get-StationProcesses 'kiosk') { Write-Host 'Kiosk: process running' }
    else { Write-Host 'Kiosk: stopped. Restart Windows and sign in to start the installed Watchdogs.' }
}
