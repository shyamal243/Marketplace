$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)

function Show-Model {
    param($content, $modelName)
    $marker = "model $modelName {"
    $idx = $content.IndexOf($marker)
    if ($idx -lt 0) {
        Write-Host "=== model $modelName NOT FOUND ===" -ForegroundColor Red
        return
    }
    $end = $content.IndexOf("`n}", $idx)
    if ($end -lt 0) { $end = [Math]::Min($content.Length, $idx + 1000) }
    Write-Host "=== model $modelName ===" -ForegroundColor Cyan
    Write-Host $content.Substring($idx, ($end - $idx) + 2)
    Write-Host ""
}

Show-Model $content "User"
Show-Model $content "Order"
Show-Model $content "Review"
Show-Model $content "Product"
Show-Model $content "Store"
Show-Model $content "DataRequest"
