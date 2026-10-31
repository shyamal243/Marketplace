$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}
$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

Write-Host "=== handleDownloadTemplate (token + blob download pattern) ===" -ForegroundColor Cyan
$idx = $content.IndexOf('async function handleDownloadTemplate')
if ($idx -ge 0) {
    $end = $content.IndexOf("`n  }", $idx)
    Write-Host $content.Substring($idx, ($end - $idx) + 5)
}

Write-Host ""
Write-Host "=== apiFetch definition ===" -ForegroundColor Cyan
$apiPath = "apps\web\app\lib\api.ts"
if (Test-Path $apiPath) {
    Write-Host ([System.IO.File]::ReadAllText((Resolve-Path $apiPath).Path))
} else {
    Write-Host "not found at $apiPath, searching..." -ForegroundColor Yellow
    Get-ChildItem -Path "apps\web\app" -Recurse -Include "api.ts","api.tsx" | ForEach-Object { Write-Host $_.FullName }
}
