$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)

Write-Host "=== Around admin risk-flag routes (end of file area) ===" -ForegroundColor Cyan
$idx = $content.IndexOf('app.post("/admin/risk-flags/:id/resolve"')
if ($idx -ge 0) {
    $start = [Math]::Max(0, $idx)
    $len = [Math]::Min(1200, $content.Length - $start)
    Write-Host $content.Substring($start, $len)
} else {
    Write-Host "Not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== requireAuth import / AuthRequest type check (top of file) ===" -ForegroundColor Cyan
$len2 = [Math]::Min(800, $content.Length)
Write-Host $content.Substring(0, $len2)

Write-Host ""
Write-Host "=== User model fields used elsewhere (search 'walletBalance') ===" -ForegroundColor Cyan
$idx3 = $content.IndexOf('walletBalance')
if ($idx3 -ge 0) {
    $start3 = [Math]::Max(0, $idx3 - 300)
    Write-Host $content.Substring($start3, 600)
}

Write-Host ""
Write-Host "=== app.listen or final lines of file ===" -ForegroundColor Cyan
$tailLen = [Math]::Min(600, $content.Length)
Write-Host $content.Substring($content.Length - $tailLen, $tailLen)
