$path = "apps\web\app\admin\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)

function Show-Snippet {
    param($label, $idx, $len = 1200)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx1 = $content.IndexOf("async function handleSetReferralReward")
Show-Snippet "handleSetReferralReward function" $idx1 900

$idx2 = $content.IndexOf("useEffect(() =>")
Show-Snippet "First useEffect (initial load)" $idx2 500

$idx3 = $content.IndexOf("async function loadAll")
Show-Snippet "loadAll function" $idx3 1200
