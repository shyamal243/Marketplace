$path = "apps\web\app\Footer.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
Write-Host $content
