$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== GET /demands/:id/bids route ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.get("/demands/:id/bids"')
if ($idx -ge 0) {
    $end = $content.IndexOf("`napp.", $idx + 10)
    Write-Host $content.Substring($idx, ($end - $idx))
} else {
    Write-Host "NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== POST /products route (ownership check pattern) ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf('app.post("/products"')
if ($idx2 -ge 0) {
    $end2 = $content.IndexOf("`napp.", $idx2 + 10)
    Write-Host $content.Substring($idx2, ($end2 - $idx2))
}
