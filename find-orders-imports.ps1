$path = "apps\web\app\orders\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)
Write-Host $content.Substring(0, [Math]::Min(600, $content.Length))
