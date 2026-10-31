$path = "apps\web\app\demands\new\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)

$idx = $content.IndexOf("<select")
while ($idx -ge 0) {
    $end = $content.IndexOf("</select>", $idx)
    if ($end -lt 0) { break }
    $chunk = $content.Substring($idx, ($end - $idx) + 9)
    if ($chunk -match "category" -or $chunk -match "option") {
        Write-Host "--- select block at $idx ---" -ForegroundColor Cyan
        Write-Host $chunk
        Write-Host ""
    }
    $idx = $content.IndexOf("<select", $end)
}

Write-Host "=== existing store toggle routes (retry, fixed script) ===" -ForegroundColor Cyan
$idxPath = "apps\api\src\index.ts"
$apiContent = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)
$patterns = @('/stores/:id/toggle', 'app.get("/admin/stores"', 'app.get("/co-admin/stores"')
foreach ($p in $patterns) {
    $i = $apiContent.IndexOf($p)
    $status = "not found"
    if ($i -ge 0) { $status = "found at $i" }
    Write-Host "pattern '$p': $status"
}
