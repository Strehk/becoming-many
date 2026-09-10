# Purpose: Execute the station's explicit branch or release deployment transaction.
# Context: Called by deploy-branch.ps1 and deploy-release.ps1 on the station account.
# Boundary: No merges, rebases, force updates, tool installation or .env writes.
param([string]$Branch)
. "$PSScriptRoot\station-deployment.ps1"

function Get-BranchTarget {
    param([string]$Name)
    $validated = Invoke-Checked git @('check-ref-format', '--branch', $Name)
    if ($Name.StartsWith('-') -or $validated -ne $Name) { throw 'Invalid branch name.' }
    Invoke-Checked git @('fetch', '--prune', 'origin') | Out-Host
    $remote = "refs/remotes/origin/$Name"
    $targetCommit = Invoke-Checked git @('rev-parse', '--verify', "$remote^{commit}")
    $rootFiles = @(Invoke-Checked git @('ls-tree', '--name-only', $remote))
    if ($rootFiles -contains '.env') {
        throw 'Target branch tracks protected station files.'
    }
    Assert-CompatibleBranch $remote
    return $targetCommit
}

function Update-BranchCheckout {
    param([string]$Name)
    $targetCommit = Get-BranchTarget $Name
    $remote = "refs/remotes/origin/$Name"
    & git show-ref --verify --quiet "refs/heads/$Name"
    if ($LASTEXITCODE -eq 0) {
        Invoke-Checked git @('merge-base', '--is-ancestor', "refs/heads/$Name", $remote) | Out-Null
        Invoke-Checked git @('switch', $Name) | Out-Host
    } elseif ($LASTEXITCODE -eq 1) {
        Invoke-Checked git @('switch', '--track', '-c', $Name, $remote) | Out-Host
    } else { throw 'Cannot inspect local branch.' }
    # Pin the validated commit: a concurrent push must not bypass .env checks.
    Invoke-Checked git @('pull', '--ff-only', 'origin', $targetCommit) | Out-Host
    Assert-CleanCheckout
}

function Assert-CompatibleBranch {
    param([string]$Remote)
    # Switching cannot replace the deployment runner or reboot contract mid-flight.
    $paths = @('scripts/deploy-branch.ps1', 'scripts/deploy-release.ps1',
        'scripts/deploy-station.ps1', 'scripts/station-deployment.ps1',
        'scripts/start-station-container.ps1', 'watchdog', 'docker-compose.yml',
        'docker-compose.build.yml', '.dockerignore')
    $difference = Invoke-Checked git (@('diff', '--name-only', 'HEAD', $Remote, '--') + $paths)
    if ($difference) { throw 'Target has different deployment infrastructure. Integrate it before deploying.' }
}

function Prepare-Image {
    if (!$Branch) { Get-ReleaseImage; return }
    $script:Commit = Invoke-Checked git @('rev-parse', 'HEAD')
    $slug = ($Branch.ToLowerInvariant() -replace '[^a-z0-9_.-]', '-').Trim('-','.')
    if (!$slug) { $slug = 'branch' }
    if ($slug.Length -gt 60) { $slug = $slug.Substring(0, 60) }
    $script:Image = "becoming-many-local:${slug}-$script:Commit"
    Write-Host "Building branch $Branch at $script:Commit"
    Invoke-Checked docker @('build', '--tag', $script:Image, '--label',
        "org.opencontainers.image.revision=$script:Commit", '.') | Out-Host
    Assert-CleanCheckout
    if ((Invoke-Checked git @('rev-parse', 'HEAD')) -ne $script:Commit) { throw 'Checkout changed during build.' }
}

function Get-ReleaseImage {
    Invoke-Checked docker @('pull', $script:ReleaseImage) | Out-Host
    $script:Image = Invoke-Checked docker @('image', 'inspect', '--format', '{{index .RepoDigests 0}}', $script:ReleaseImage)
    $metadata = (Invoke-Checked docker @('image', 'inspect', $script:Image) | ConvertFrom-Json)[0]
    $script:Commit = 'unknown (release has no revision label)'
    if ($metadata.Config.PSObject.Properties['Labels'] -and $metadata.Config.Labels -and
        $metadata.Config.Labels.PSObject.Properties['org.opencontainers.image.revision']) {
        $script:Commit = $metadata.Config.Labels.'org.opencontainers.image.revision'
    }
}

$lock = $null
$paused = @()
$location = Get-Location
try {
    Initialize-Station
    $lock = Open-DeploymentLock
    Assert-CleanCheckout
    $envHash = (Get-FileHash -LiteralPath '.env' -Algorithm SHA256).Hash
    # Stop before switching tracked Watchdog files; Docker's hook shares our lock.
    foreach ($port in @(2350, 2349)) {
        if (!(Test-WatchdogListening $port)) {
            Write-Host "[watchdog:$port] Not running; leaving it stopped until Windows sign-in."
            continue
        }
        Send-WatchdogCommand $port 'status'
        $paused += $port
        Send-WatchdogCommand $port 'stop'
    }
    Wait-StationProcess 'kiosk' $false
    Wait-StationProcess 'poller' $false
    if ($Branch) { Update-BranchCheckout $Branch }
    if ((Get-FileHash -LiteralPath '.env' -Algorithm SHA256).Hash -ne $envHash) { throw '.env changed externally.' }
    Start-DeploymentDocker
    Wait-Engine
    Prepare-Image
    # Persist before recreation: a crash/reboot must recover the intended image.
    $displayBranch = if ($Branch) { $Branch } else { 'release (GHCR)' }
    Write-DeploymentState $script:Image $displayBranch $script:Commit
    Start-StationContainer -Recreate
    Wait-StationHealth
} catch {
    Write-Error "Deployment failed: $_ Recovery: see docs/operations.md." -ErrorAction Continue
    throw
} finally {
    # Try both even when the first watchdog cannot be reached.
    $restoreFailed = $false
    foreach ($port in @($paused | Sort-Object)) {
        try { Send-WatchdogCommand $port 'start' }
        catch { $restoreFailed = $true; Write-Warning "Watchdog $port restore failed: $_" }
    }
    if ($lock) { $lock.Dispose() }
    Set-Location -LiteralPath $location.Path
}
if ($restoreFailed) { throw 'Watchdog restoration incomplete. See recovery instructions.' }
if ($paused -contains 2349) { Wait-StationProcess 'poller' $true }
if ($paused -contains 2350) { Wait-StationProcess 'kiosk' $true }
Wait-StationHealth
Show-DeploymentResult $displayBranch $script:Commit $script:Image
