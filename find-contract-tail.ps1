$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw
Write-Host "Total length: $($content.Length) characters"
Write-Host ""
Write-Host "===== Last 1500 characters of contract.prisma =====" -ForegroundColor Cyan
Write-Host $content.Substring([Math]::Max(0, $content.Length - 1500))

Write-Host ""
Write-Host "===== A sample existing model for style reference (WalletTransaction) =====" -ForegroundColor Cyan
$idx = $content.IndexOf("model WalletTransaction")
if ($idx -ge 0) {
    Write-Host $content.Substring($idx, [Math]::Min(600, $content.Length - $idx))
} else {
    Write-Host "(not found)"
}
