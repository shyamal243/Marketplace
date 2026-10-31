$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw

function Show-Snippet {
    param($label, $idx, $len = 2500)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

$walletIdx = $content.IndexOf('"/wallet/topup"')
if ($walletIdx -eq -1) { $walletIdx = $content.IndexOf("'/wallet/topup'") }
if ($walletIdx -eq -1) { $walletIdx = $content.IndexOf("WalletTransaction.create") }
Show-Snippet "Wallet top-up / WalletTransaction pattern" $walletIdx

$refIdx = $content.IndexOf("referral-reward")
Show-Snippet "Referral-reward setting route" $refIdx 3000

$settingIdx = $content.IndexOf("PlatformSetting.where")
Show-Snippet "PlatformSetting read pattern" $settingIdx 1200
