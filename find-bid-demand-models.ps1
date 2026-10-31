$path = "apps\api\src\prisma\contract.prisma"
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
    if ($end -lt 0) { $end = [Math]::Min($content.Length, $idx + 1200) }
    Write-Host "=== model $modelName ===" -ForegroundColor Cyan
    Write-Host $content.Substring($idx, ($end - $idx) + 2)
    Write-Host ""
}

Show-Model $content "Demand"
Show-Model $content "Bid"

Write-Host "=== bid-related frontend files ===" -ForegroundColor Cyan
Get-ChildItem -Path "apps\web\app" -Recurse -Include "*.tsx" | Where-Object { $_.FullName -match "demand|bid" } | ForEach-Object { Write-Host $_.FullName }
