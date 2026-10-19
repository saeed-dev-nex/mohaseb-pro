param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot

function Invoke-Git([string[]]$Arguments) {
    & git -C $projectRoot @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($Arguments -join ' ')" }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not installed or is not on PATH.' }
Invoke-Git @('rev-parse', '--is-inside-work-tree') | Out-Null
$changes = & git -C $projectRoot status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Could not read the Git working tree.' }
if ($changes) {
    Write-Warning 'Uncommitted local changes were found. Update stopped to avoid overwriting them.'
    Write-Output $changes
    exit 2
}

Invoke-Git @('fetch', 'origin')
$branch = (& git -C $projectRoot branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) { throw 'The current Git branch could not be determined.' }
$remoteBranch = "origin/$branch"
& git -C $projectRoot rev-parse --verify $remoteBranch 2>$null
if ($LASTEXITCODE -ne 0) { throw "Remote branch $remoteBranch was not found." }

$counts = (& git -C $projectRoot rev-list --left-right --count "HEAD...$remoteBranch").Trim().Split([char[]]' ', [System.StringSplitOptions]::RemoveEmptyEntries)
$ahead = [int]$counts[0]
$behind = [int]$counts[1]
if ($behind -eq 0) {
    Write-Output 'This system is already synchronized with GitHub.'
    exit 0
}
if ($ahead -gt 0) {
    Write-Output 'The local branch has commits; merging the GitHub update safely.'
    Invoke-Git @('merge', '--no-edit', $remoteBranch)
} else {
    Invoke-Git @('merge', '--ff-only', $remoteBranch)
}
Write-Output 'Project code updated from GitHub.'

if (-not $SkipBuild) {
    $backendSetup = Join-Path $projectRoot 'backend\first_run_setup.bat'
    if (-not (Test-Path -LiteralPath $backendSetup -PathType Leaf)) { throw 'backend\\first_run_setup.bat was not found.' }
    & $backendSetup
    if ($LASTEXITCODE -ne 0) { throw 'Backend setup or database migrations failed.' }
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend production build failed.' }
    } finally {
        Pop-Location
    }
    Write-Output 'Dependencies, migrations, and the production build are ready.'
}
