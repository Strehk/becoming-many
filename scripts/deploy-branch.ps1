# Purpose: Deploy a clean remote branch on the Windows installation.
# Boundary: Fast-forward only; station configuration and local commits are preserved.
param([ValidateNotNullOrEmpty()][string]$Branch = 'david_refactor')
. "$PSScriptRoot\deploy-station.ps1" -Branch $Branch
