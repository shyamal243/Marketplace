$path = "apps\api\prisma.config.ts"
if (-not (Test-Path $path)) { $path = "prisma.config.ts" }
if (-not (Test-Path $path)) {
    Write-Host "Could not find prisma.config.ts" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $path"
Write-Host "-----"
Get-Content $path -Raw
