$path = "apps\web\app\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
Write-Host "Length: $($content.Length) chars"
Write-Host ""
Write-Host $content
