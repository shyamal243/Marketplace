$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

function Show-Snippet {
    param($label, $idx, $len = 1500)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx1 = $content.IndexOf("onClick={handleCheckout}")
Show-Snippet "Checkout button JSX (from onClick anchor)" ([Math]::Max(0, $idx1 - 600)) 1200

$idx2 = $content.IndexOf("const [cart, setCart]")
Show-Snippet "Cart state declaration area" $idx2 400
