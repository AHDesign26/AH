# Create the directory junction public/static -> ../static so Astro serves
# the existing Flask static assets at the same /static/* URLs.
#
# Idempotent: prints a notice and exits 0 if the junction already exists.
# Run once per fresh clone (Windows). For Linux/macOS, see setup-public-static.sh.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $repoRoot 'public'
$junctionPath = Join-Path $publicDir 'static'
$targetPath = Join-Path $repoRoot 'static'

if (-not (Test-Path $targetPath)) {
    Write-Error "static/ does not exist at $targetPath; nothing to link."
    exit 1
}

if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir | Out-Null
}

if (Test-Path $junctionPath) {
    Write-Host "public/static already exists at $junctionPath"
    exit 0
}

cmd /c mklink /J "$junctionPath" "$targetPath" | Out-Null
Write-Host "Created junction public/static -> $targetPath"
