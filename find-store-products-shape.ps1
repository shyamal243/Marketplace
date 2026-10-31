$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== GET /stores/:id/products route ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.get("/stores/:id/products"')
if ($idx -ge 0) {
    $end = $content.IndexOf("`napp.", $idx + 10)
    Write-Host $content.Substring($idx, ($end - $idx))
}

Write-Host ""
Write-Host "=== loadProducts function full body (frontend) ===" -ForegroundColor Cyan
$pagePath = "apps\web\app\stores\[id]\page.tsx"
$pageContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $pagePath).Path)
$idx2 = $pageContent.IndexOf("async function loadProducts")
if ($idx2 -ge 0) {
    $end2 = $pageContent.IndexOf("async function", $idx2 + 20)
    Write-Host $pageContent.Substring($idx2, ($end2 - $idx2))
}

Write-Host ""
Write-Host "=== where store name is displayed in JSX (search 'h1' and 'store.name' and 'storeName') ===" -ForegroundColor Cyan
$idx3 = $pageContent.IndexOf("<h1")
if ($idx3 -ge 0) {
    Write-Host $pageContent.Substring($idx3, 400)
}
