$candidates = Get-ChildItem -Path "apps\web\app" -Recurse -Include "*.tsx" | Where-Object { $_.FullName -match "co-admin" }
if ($candidates.Count -eq 0) {
    Write-Host "No co-admin page found under apps\web\app" -ForegroundColor Red
} else {
    $candidates | ForEach-Object {
        Write-Host "=== $($_.FullName) ===" -ForegroundColor Cyan
        $len = (Get-Item $_.FullName).Length
        Write-Host "Length: $len bytes"
    }
}

Write-Host ""
Write-Host "=== co-admin route anchor in index.ts ===" -ForegroundColor Cyan
$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)
$idx = $content.IndexOf('app.post("/co-admin/settings/referral-reward"')
if ($idx -ge 0) {
    $start = [Math]::Max(0, $idx - 50)
    Write-Host $content.Substring($start, 500)
}
