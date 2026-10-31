$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

function Show-Snippet {
    param($label, $idx, $len = 1000)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$idx1 = $content.IndexOf("const [bulkError, setBulkError]")
Show-Snippet "Bulk-upload state area (for adding hygiene state after it)" $idx1 400

$idx2 = $content.IndexOf("useEffect(() => {")
Show-Snippet "First useEffect (initial load)" $idx2 400

$idx3 = $content.IndexOf("async function handleDownloadTemplate")
Show-Snippet "handleDownloadTemplate function (style reference for auth blob pattern)" $idx3 200

$idx4 = $content.IndexOf("Bulk upload products (Excel)")
Show-Snippet "Bulk upload JSX heading area" ([Math]::Max(0, $idx4 - 100)) 300
