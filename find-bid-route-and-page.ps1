$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== POST /bids route ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.post("/bids"')
if ($idx -ge 0) {
    $end = $content.IndexOf("`napp.", $idx + 10)
    Write-Host $content.Substring($idx, ($end - $idx))
}

Write-Host ""
Write-Host "=== GET /demands/:id route ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf('app.get("/demands/:id"')
if ($idx2 -ge 0) {
    $end2 = $content.IndexOf("`napp.", $idx2 + 10)
    Write-Host $content.Substring($idx2, ($end2 - $idx2))
}

Write-Host ""
Write-Host "=== any existing 'my products' or seller product listing route ===" -ForegroundColor Cyan
$idx3 = $content.IndexOf('/products/mine')
if ($idx3 -ge 0) {
    Write-Host "found /products/mine"
} else {
    Write-Host "not found: /products/mine"
}
$idx4 = $content.IndexOf('app.get("/stores/mine"')
if ($idx4 -ge 0) {
    $end4 = $content.IndexOf("`napp.", $idx4 + 10)
    Write-Host $content.Substring($idx4, ($end4 - $idx4))
} else {
    Write-Host "not found: /stores/mine"
}

Write-Host ""
Write-Host "=== demands/[id]/page.tsx (full) ===" -ForegroundColor Cyan
$pagePath = "apps\web\app\demands\[id]\page.tsx"
Write-Host ([System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $pagePath).Path))
