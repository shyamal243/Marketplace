Write-Host "===== prisma contract emit --help =====" -ForegroundColor Cyan
pnpm prisma contract emit --help

Write-Host ""
Write-Host "===== Trying with DEBUG=* =====" -ForegroundColor Cyan
$env:DEBUG = "*"
pnpm prisma contract emit
Remove-Item Env:\DEBUG
