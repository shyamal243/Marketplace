$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw

function Show-Snippet {
    param($label, $idx, $len = 3500)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx = $content.IndexOf('"/store-orders"')
if ($idx -eq -1) { $idx = $content.IndexOf("'/store-orders'") }
Show-Snippet "POST /store-orders route" $idx 4500
