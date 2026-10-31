$path = "apps\web\app\login\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$lines = $content -split "`r?`n"
Write-Host "Total lines: $($lines.Count)"
Write-Host ""
Write-Host $content
