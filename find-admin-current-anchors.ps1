$path = "apps\web\app\admin\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)

Write-Host "=== tab type union ===" -ForegroundColor Cyan
$idx = $content.IndexOf('useState<"users"')
if ($idx -ge 0) { Write-Host $content.Substring($idx, 150) }

Write-Host ""
Write-Host "=== tab button array ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf('as const).map((t) => (')
if ($idx2 -ge 0) {
    $start2 = [Math]::Max(0, $idx2 - 100)
    Write-Host $content.Substring($start2, 250)
}

Write-Host ""
Write-Host "=== dataRequests state block ===" -ForegroundColor Cyan
$idx3 = $content.IndexOf('const [dataRequests')
if ($idx3 -ge 0) { Write-Host $content.Substring($idx3, 200) }

Write-Host ""
Write-Host "=== lazy-load useEffect ===" -ForegroundColor Cyan
$idx4 = $content.IndexOf('if (tab === "privacy") {')
if ($idx4 -ge 0) {
    $start4 = [Math]::Max(0, $idx4 - 150)
    Write-Host $content.Substring($start4, 350)
}

Write-Host ""
Write-Host "=== handleRejectDataRequest through 'if (loading)' ===" -ForegroundColor Cyan
$idx5 = $content.IndexOf('async function handleRejectDataRequest')
if ($idx5 -ge 0) {
    $end5 = $content.IndexOf('if (loading) {', $idx5)
    if ($end5 -ge 0) { Write-Host $content.Substring($idx5, ($end5 - $idx5) + 20) }
}

Write-Host ""
Write-Host "=== privacy tab JSX through start of coupons tab JSX ===" -ForegroundColor Cyan
$idx6 = $content.IndexOf('{tab === "privacy" && (')
if ($idx6 -ge 0) {
    $idxCoupons = $content.IndexOf('{tab === "coupons" && (', $idx6)
    if ($idxCoupons -ge 0) {
        $tail = $content.Substring($idxCoupons - 20, 50)
        Write-Host "End marker context: $tail"
    }
}
