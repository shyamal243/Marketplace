$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw

function Show-Snippet {
    param($label, $idx, $len = 3000)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx = $content.IndexOf('"/products"')
if ($idx -eq -1) { $idx = $content.IndexOf("'/products'") }
Show-Snippet "POST /products route" $idx 3500

$idx2 = $content.IndexOf("StoreAccess.where")
Show-Snippet "StoreAccess usage pattern (from co-supplier feature)" $idx2 1500
