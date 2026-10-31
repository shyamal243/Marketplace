$root = "apps\web\app"
if (-not (Test-Path $root)) {
    Write-Host "Could not find $root - run this from the repo root." -ForegroundColor Red
    exit 1
}

Write-Host "Searching for links/references to the /stores index page (not /stores/[id] detail pages)..." -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Path $root -Recurse -Include *.tsx,*.ts -File

foreach ($f in $files) {
    $lines = Get-Content -LiteralPath $f.FullName
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line -match '(href|Link)\s*=?\s*[\{"]?[''"]?/stores[''"]?[\}]?' -and $line -notmatch '/stores/') {
            Write-Host ("{0}:{1}: {2}" -f $f.FullName.Replace((Get-Location).Path + "\", ""), ($i + 1), $line.Trim())
        }
    }
}

Write-Host ""
Write-Host "===== Current content of stores/page.tsx =====" -ForegroundColor Cyan
$storesPage = Join-Path $root "stores\page.tsx"
if (Test-Path -LiteralPath $storesPage) {
    Get-Content -LiteralPath $storesPage -Raw
} else {
    Write-Host "stores/page.tsx not found at expected path"
}
