$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== all route lines containing '/stores' ===" -ForegroundColor Cyan
$lines = $content -split "`n"
foreach ($line in $lines) {
    if ($line -match 'app\.(get|post|patch|put|delete)\("/stores') {
        Write-Host $line
    }
}

Write-Host ""
Write-Host "=== how stores/[id]/page.tsx loads its store data ===" -ForegroundColor Cyan
$pagePath = "apps\web\app\stores\[id]\page.tsx"
$pageContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $pagePath).Path)
$idx = $pageContent.IndexOf("async function loadData")
if ($idx -ge 0) {
    $end = $pageContent.IndexOf("`n  }", $idx)
    Write-Host $pageContent.Substring($idx, ($end - $idx) + 5)
}

Write-Host ""
Write-Host "=== print-settings related route/handler ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf("print-settings")
if ($idx2 -ge 0) {
    Write-Host $content.Substring([Math]::Max(0,$idx2-100), 500)
}
$idx3 = $pageContent.IndexOf("print-settings")
if ($idx3 -ge 0) {
    Write-Host "--- frontend handler ---"
    Write-Host $pageContent.Substring([Math]::Max(0,$idx3-300), 700)
}
