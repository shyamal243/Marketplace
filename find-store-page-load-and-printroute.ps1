$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== full /stores/:id/print-settings route ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.post("/stores/:id/print-settings"')
if ($idx -ge 0) {
    $end = $content.IndexOf("`napp.", $idx + 10)
    Write-Host $content.Substring($idx, ($end - $idx))
}

Write-Host ""
Write-Host "=== stores/[id]/page.tsx: top portion (imports, interfaces, data loading) ===" -ForegroundColor Cyan
$pagePath = "apps\web\app\stores\[id]\page.tsx"
$pageContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $pagePath).Path)
Write-Host $pageContent.Substring(0, 3000)
