$adminPath = "apps\web\app\admin\page.tsx"
if (-not (Test-Path $adminPath)) {
    Write-Host "Could not find $adminPath - run this from the repo root." -ForegroundColor Red
    exit 1
}
$admin = [System.IO.File]::ReadAllText((Resolve-Path $adminPath).Path)

Write-Host "=== admin tab type union ===" -ForegroundColor Cyan
$idx = $admin.IndexOf('useState<"users"')
if ($idx -ge 0) { Write-Host $admin.Substring($idx, 150) }

Write-Host ""
Write-Host "=== admin tab button array ===" -ForegroundColor Cyan
$idx2 = $admin.IndexOf('as const).map((t) => (')
if ($idx2 -ge 0) {
    $start2 = [Math]::Max(0, $idx2 - 100)
    Write-Host $admin.Substring($start2, 250)
}

Write-Host ""
Write-Host "=== riskFlags state block ===" -ForegroundColor Cyan
$idx3 = $admin.IndexOf('const [riskFlags')
if ($idx3 -ge 0) {
    Write-Host $admin.Substring($idx3, 200)
}

Write-Host ""
Write-Host "=== lazy-load useEffect ===" -ForegroundColor Cyan
$idx4 = $admin.IndexOf('if (tab === "coupons") {')
if ($idx4 -ge 0) {
    $start4 = [Math]::Max(0, $idx4 - 30)
    Write-Host $admin.Substring($start4, 250)
}

Write-Host ""
Write-Host "=== handleResolveRiskFlag through 'if (loading)' ===" -ForegroundColor Cyan
$idx5 = $admin.IndexOf('async function handleResolveRiskFlag')
if ($idx5 -ge 0) {
    $end5 = $admin.IndexOf('if (loading) {', $idx5)
    if ($end5 -ge 0) {
        Write-Host $admin.Substring($idx5, ($end5 - $idx5) + 20)
    }
}

Write-Host ""
Write-Host "=== risk tab JSX through start of coupons tab JSX ===" -ForegroundColor Cyan
$idx6 = $admin.IndexOf('{tab === "risk" && (')
if ($idx6 -ge 0) {
    $idxCoupons = $admin.IndexOf('{tab === "coupons" && (', $idx6)
    if ($idxCoupons -ge 0) {
        Write-Host $admin.Substring($idx6, ($idxCoupons - $idx6) + 30)
    }
}

Write-Host ""
Write-Host "=== apiFetch import in admin page ===" -ForegroundColor Cyan
$idx7 = $admin.IndexOf('import')
Write-Host $admin.Substring($idx7, 400)

Write-Host ""
Write-Host "=== nav/header component search ===" -ForegroundColor Cyan
$navCandidates = Get-ChildItem -Path "apps\web\app" -Recurse -Include "*.tsx" | Where-Object { $_.Name -match "nav|header|layout" }
$navCandidates | ForEach-Object { Write-Host $_.FullName }
