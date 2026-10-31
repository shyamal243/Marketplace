$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== GET /co-admin/users route (city scoping pattern) ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.get("/co-admin/users"')
if ($idx -ge 0) {
    $end = $content.IndexOf("`napp.", $idx + 10)
    Write-Host $content.Substring($idx, ($end - $idx))
}

Write-Host ""
Write-Host "=== GET /co-admin/orders route ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf('app.get("/co-admin/orders"')
if ($idx2 -ge 0) {
    $end2 = $content.IndexOf("`napp.", $idx2 + 10)
    Write-Host $content.Substring($idx2, ($end2 - $idx2))
}
