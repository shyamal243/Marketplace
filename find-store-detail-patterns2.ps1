$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

function Show-Snippet {
    param($label, $idx, $len = 2500)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx1 = $content.IndexOf("onSubmit={handleAddProduct}")
Show-Snippet "Add-product form JSX (via onSubmit anchor)" $idx1 2200

$idx2 = $content.IndexOf("co-supplier", [System.StringComparison]::OrdinalIgnoreCase)
Show-Snippet "Co-supplier panel area" $idx2 1500

Write-Host ""
Write-Host "===== apps/web/app/lib/api.ts (full content) =====" -ForegroundColor Cyan
$apiLibPath = "apps\web\app\lib\api.ts"
if (Test-Path $apiLibPath) {
    Get-Content $apiLibPath -Raw
} else {
    Write-Host "(not found at expected path)"
}
