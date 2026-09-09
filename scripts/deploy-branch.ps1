# Purpose: Deploy a clean remote branch on the Windows installation.
# Boundary: Fast-forward only; station configuration and local commits are preserved.
param([Parameter(Mandatory = $true)][string]$Branch)
. "$PSScriptRoot\deploy-station.ps1" -Branch $Branch
