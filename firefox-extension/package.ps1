$ErrorActionPreference = 'Stop'

$extensionRoot = $PSScriptRoot
$releaseDirectory = Join-Path $extensionRoot 'release'
$archivePath = Join-Path $releaseDirectory 'mohaseb-pro-firefox-1.1.0.zip'

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
Push-Location $extensionRoot
try {
    Compress-Archive -Path @(
        'manifest.json',
        'background.js',
        'popup.html',
        'popup.js',
        'styles.css',
        'icons'
    ) -DestinationPath $archivePath -Force
} finally {
    Pop-Location
}

Write-Output "AMO upload package created: $archivePath"
