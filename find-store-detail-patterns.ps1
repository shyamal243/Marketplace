$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

function Show-Snippet {
    param($label, $idx, $len = 2000)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

Write-Host "Total length: $($content.Length) characters"

# Top imports + API base url usage
$idx0 = $content.IndexOf("import")
Show-Snippet "Top of file (imports)" $idx0 1000

# handleAddProduct function
$idx1 = $content.IndexOf("handleAddProduct")
Show-Snippet "handleAddProduct (state/handler)" $idx1 1800

# Add product form JSX
$idx2 = $content.IndexOf("Add Product")
Show-Snippet "Add Product form JSX area" $idx2 2000

# isManager / isTrueSeller checks
$idx3 = $content.IndexOf("isTrueSeller")
Show-Snippet "isManager / isTrueSeller definitions" $idx3 800

# Raw fetch + FormData pattern (KYC-style upload)
$idx4 = $content.IndexOf("FormData()")
Show-Snippet "Existing FormData/raw-fetch upload pattern" $idx4 1500
