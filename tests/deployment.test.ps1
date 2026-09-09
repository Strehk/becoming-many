# Purpose: Exercise deployment safety with temporary files and mocked station services.
# Context: Run with Windows PowerShell 5.1 or pwsh; no Pester or Docker required.
# Boundary: Does not connect to a station or mutate the project's Git checkout.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $project 'scripts/station-deployment.ps1')
$source = Get-Content (Join-Path $project 'scripts/deploy-station.ps1') -Raw
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) {
        . ([scriptblock]::Create($statement.Extent.Text))
    }
}
$transaction = [scriptblock]::Create($source.Substring($source.IndexOf('$lock = $null')))

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

$temporary = Join-Path ([IO.Path]::GetTempPath()) ('station-tests-' + [guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($temporary)
$originalLocation = Get-Location
try {
    $script:StationRoot = $temporary
    [void][IO.Directory]::CreateDirectory((Join-Path $temporary '.git'))
    $script:StatePath = Join-Path $temporary '.git/station-deployment.json'
    Set-Location -LiteralPath $temporary
    [IO.File]::WriteAllText((Join-Path $temporary '.env'), 'STATION_NAME=test')
    $envHash = (Get-FileHash '.env').Hash

    Assert-True (!((Get-ComposeArguments) -contains $script:StatePath)) 'Default must use base Compose only.'
    Write-DeploymentState 'becoming-many-local:feature-test-abc' 'feature/test' 'abc'
    Assert-True ((Get-ComposeArguments) -contains $script:StatePath) 'Branch selection must survive another launcher call.'
    Write-DeploymentState ('ghcr.io/strehk/becoming-many@sha256:' + ('a' * 64)) 'release' 'def'
    $previous = Get-Content "$script:StatePath.previous" -Raw | ConvertFrom-Json
    Assert-True ($previous.services.station.image -eq 'becoming-many-local:feature-test-abc') 'Previous selection lost.'
    Write-DeploymentState 'ghcr.io/strehk/becoming-many:latest' 'bad' 'bad'
    Assert-Throws { Get-ComposeArguments } 'Invalid deployment state'
    Write-DeploymentState 'becoming-many-local:feature-test-abc' 'feature/test' 'abc'
    $lock = Open-DeploymentLock
    try { Assert-Throws { Open-DeploymentLock } 'used by another process' }
    finally { $lock.Dispose() }
    $lock = Open-DeploymentLock
    $lock.Dispose()

    function Failing-Native { $global:LASTEXITCODE = 17 }
    Assert-Throws { Invoke-Checked Failing-Native @() } 'exit 17'

    # Real Git fixtures prove the safeguards without touching the project branch.
    & {
        $remote = Join-Path $temporary 'remote'
        $clone = Join-Path $temporary 'clone'
        Invoke-Checked git @('init', '--initial-branch=fixture', $remote) | Out-Null
        Set-Location $remote
        Invoke-Checked git @('config', 'user.name', 'Deployment Test')
        Invoke-Checked git @('config', 'user.email', 'deployment@example.invalid')
        Invoke-Checked git @('config', 'commit.gpgsign', 'false')
        [IO.File]::WriteAllText((Join-Path $remote '.gitignore'), '.env')
        Invoke-Checked git @('add', '.gitignore')
        Invoke-Checked git @('commit', '-m', 'fixture') | Out-Null
        Invoke-Checked git @('branch', 'feature/test')
        Invoke-Checked git @('clone', $remote, $clone) | Out-Null
        Set-Location $clone
        [IO.File]::WriteAllText((Join-Path $clone '.env'), 'STATION_NAME=test')
        Update-BranchCheckout 'feature/test'
        Assert-True ((Invoke-Checked git @('branch', '--show-current')) -eq 'feature/test') 'Branch switch failed.'
        Update-BranchCheckout 'feature/test'
        Assert-Throws { Update-BranchCheckout 'missing' } 'failed'
        Assert-Throws { Update-BranchCheckout '@{-1}' } 'Invalid branch name'
        [IO.File]::WriteAllText((Join-Path $clone 'untracked.txt'), 'local work')
        Assert-Throws { Assert-CleanCheckout } 'Uncommitted changes'
        [IO.File]::Delete((Join-Path $clone 'untracked.txt'))
        Set-Location $remote
        Invoke-Checked git @('switch', '-c', 'unsafe-env') | Out-Null
        [IO.File]::WriteAllText((Join-Path $remote '.ENV'), 'do not deploy')
        Invoke-Checked git @('add', '-f', '.ENV')
        Invoke-Checked git @('commit', '-m', 'unsafe env fixture') | Out-Null
        Set-Location $clone
        Assert-Throws { Update-BranchCheckout 'unsafe-env' } 'protected station files'
        Assert-True ((Get-Content '.env' -Raw) -eq 'STATION_NAME=test') 'Git replaced station .env.'
        Invoke-Checked git @('config', 'user.name', 'Deployment Test')
        Invoke-Checked git @('config', 'user.email', 'deployment@example.invalid')
        Invoke-Checked git @('config', 'commit.gpgsign', 'false')
        Invoke-Checked git @('commit', '--allow-empty', '-m', 'local only') | Out-Null
        Assert-Throws { Update-BranchCheckout 'feature/test' } 'failed'
        Set-Location $temporary
        Write-Host 'PASS real Git: branch, repeat, missing, shorthand, dirty, tracked .env and local-only commit'
    }

    # Use the real transaction body; replace only external station boundaries.
    foreach ($failure in @('', 'dirty', 'build', 'up', 'health', 'stop', 'restore')) {
        & {
            $Branch = 'feature/test'
            $events = New-Object 'Collections.Generic.List[string]'
            function Initialize-Station { Set-Location -LiteralPath $temporary }
            function Assert-CleanCheckout { if ($failure -eq 'dirty') { throw 'injected dirty' } }
            function Send-WatchdogCommand {
                param([int]$Port, [string]$Command)
                $events.Add("${Port}:$Command")
                if ($failure -eq 'stop' -and $Command -eq 'stop') { throw 'injected stop' }
                if ($failure -eq 'restore' -and $Port -eq 2349 -and $Command -eq 'start') { throw 'injected restore' }
            }
            function Wait-StationProcess { param($Kind, $Running) }
            function Update-BranchCheckout { param($Name) $events.Add('checkout') }
            function Wait-Engine {}
            function Prepare-Image {
                $events.Add('build')
                if ($failure -eq 'build') { throw 'injected build' }
                $script:Image = 'becoming-many-local:test-abc'
                $script:Commit = 'abc'
            }
            function Write-DeploymentState { param($Image, $Branch, $Commit) $events.Add('state') }
            function Start-StationContainer {
                param([switch]$Recreate)
                $events.Add('up')
                if ($failure -eq 'up') { throw 'injected up' }
            }
            function Wait-StationHealth { if ($failure -eq 'health') { throw 'injected health' } }
            function Show-DeploymentResult { param($Branch, $Commit, $Image) $events.Add('success') }
            if (!$failure) { & $transaction } else {
                $pattern = if ($failure -eq 'restore') { 'restoration incomplete' } else { "injected $failure" }
                Assert-Throws { & $transaction } $pattern
            }
            if ($failure -eq 'dirty') {
                Assert-True ($events.Count -eq 0) 'Dirty checkout caused station side effects.'
            } else {
                Assert-True ($events -contains '2350:start') 'Kiosk restoration was skipped.'
                if ($failure -ne 'stop') { Assert-True ($events -contains '2349:start') 'Poller restoration was skipped.' }
            }
            if ($failure -in @('dirty', 'build', 'stop')) {
                Assert-True (!($events -contains 'state')) 'Failed preparation changed selected image.'
            }
            if (!$failure) {
                Assert-True ($events.IndexOf('state') -lt $events.IndexOf('up')) 'Image selection must precede recreation.'
                Assert-True ($events -contains 'success') 'Successful deployment omitted its result.'
            } else { Assert-True (!($events -contains 'success')) 'Failure reported success.' }
            $released = Open-DeploymentLock
            $released.Dispose()
            Write-Host "PASS transaction '$failure'"
        }
    }
    Assert-True ((Get-FileHash '.env').Hash -eq $envHash) '.env changed.'
    Write-Host 'PASS state, exclusion, native failure, lifecycle and .env checks'
} finally {
    Set-Location -LiteralPath $originalLocation.Path
    # Only this test-created, randomly named directory is removed.
    [IO.Directory]::Delete($temporary, $true)
}
