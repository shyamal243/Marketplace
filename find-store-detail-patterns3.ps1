$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)

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

# End of Add-product form: find "Adding..." or the submit button, print onward to include </form>
$idx1 = $content.IndexOf('placeholder="Stock')
Show-Snippet "Tail end of Add-product form (from Stock input onward)" $idx1 1200

$idx2 = $content.IndexOf("Manage co-suppliers")
Show-Snippet "Co-supplier panel heading area" $idx2 800

# State declarations near the top (to see where useState hooks end, for adding new ones)
$idx3 = $content.IndexOf("const [assignEmail")
Show-Snippet "State declarations near assignEmail (co-supplier state)" ([Math]::Max(0, $idx3 - 300)) 900
