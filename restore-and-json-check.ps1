$path = "apps\api\src\prisma\contract.prisma"
$backupPath = "$path.bak"

if (Test-Path $backupPath) {
    Copy-Item $backupPath $path -Force
    Write-Host "Restored contract.prisma from backup (with HygienePhoto included again)." -ForegroundColor Green
} else {
    Write-Host "No backup found at $backupPath - skipping restore." -ForegroundColor Yellow
}
