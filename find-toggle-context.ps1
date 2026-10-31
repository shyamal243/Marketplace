$idxPath = "apps\api\src\index.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $idxPath).Path)

Write-Host "=== existing store toggle / isActive routes ===" -ForegroundColor Cyan
$patterns = @('/stores/:id/toggle', 'isActive: !', 'app.get("/admin/stores"', 'app.get("/co-admin/stores"')
foreach ($p in $patterns) {
    $idx = $content.IndexOf($p)
    Write-Host "--- pattern: $p -> " (if ($idx -ge 0) { "found at $idx" } else { "not found" })
}

Write-Host ""
Write-Host "=== PlatformSetting model ===" -ForegroundColor Cyan
$schemaPath = "apps\api\src\prisma\contract.prisma"
$schema = [System.IO.File]::ReadAllText((Resolve-Path $schemaPath).Path)
$idx2 = $schema.IndexOf("model PlatformSetting {")
if ($idx2 -ge 0) {
    $end2 = $schema.IndexOf("`n}", $idx2)
    Write-Host $schema.Substring($idx2, ($end2 - $idx2) + 2)
}

Write-Host ""
Write-Host "=== existing referral-reward admin route (PlatformSetting usage pattern) ===" -ForegroundColor Cyan
$idx3 = $content.IndexOf('app.post("/admin/settings/referral-reward"')
if ($idx3 -ge 0) {
    $end3 = $content.IndexOf("`napp.", $idx3 + 10)
    Write-Host $content.Substring($idx3, ($end3 - $idx3))
}

Write-Host ""
Write-Host "=== demand category values used in frontend (demands/new) ===" -ForegroundColor Cyan
$newDemandPath = "apps\web\app\demands\new\page.tsx"
$newDemandContent = [System.IO.File]::ReadAllText((Resolve-Path $newDemandPath).Path)
$idx4 = $newDemandContent.IndexOf("category")
if ($idx4 -ge 0) {
    Write-Host $newDemandContent.Substring([Math]::Max(0,$idx4-200), 900)
}

Write-Host ""
Write-Host "=== POST /demands route ===" -ForegroundColor Cyan
$idx5 = $content.IndexOf('app.post("/demands"')
if ($idx5 -ge 0) {
    $end5 = $content.IndexOf("`napp.", $idx5 + 10)
    Write-Host $content.Substring($idx5, ($end5 - $idx5))
}
