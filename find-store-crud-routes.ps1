$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

$patterns = @('app.post("/stores"', 'app.patch("/stores/:id"', 'app.put("/stores/:id"', 'app.get("/stores/:id"')
foreach ($p in $patterns) {
    $idx = $content.IndexOf($p)
    Write-Host "=== $p ===" -ForegroundColor Cyan
    if ($idx -ge 0) {
        $end = $content.IndexOf("`napp.", $idx + 10)
        Write-Host $content.Substring($idx, ($end - $idx))
    } else {
        Write-Host "NOT FOUND" -ForegroundColor Red
    }
    Write-Host ""
}
