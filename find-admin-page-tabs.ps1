$path = "apps\web\app\admin\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
Write-Host "Total length: $($content.Length) characters"

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

# tab type / tab state
$idx1 = $content.IndexOf('useState<"')
Show-Snippet "Tab state type declaration" $idx1 400

# tab button row
$idx2 = $content.IndexOf("as const).map((t)")
Show-Snippet "Tab button row" ([Math]::Max(0, $idx2 - 200)) 900

# settings tab section (to append a coupons tab section after it, similar style)
$idx3 = $content.IndexOf('tab === "settings"')
Show-Snippet "Settings tab JSX (for style reference)" $idx3 1200
