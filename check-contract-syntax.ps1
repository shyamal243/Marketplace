$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw

$idx1 = $content.IndexOf("model Store")
if ($idx1 -ge 0) {
    $start = $content.IndexOf("{", $idx1)
    $depth = 0
    $end = $start
    for ($i = $start; $i -lt $content.Length; $i++) {
        if ($content[$i] -eq '{') { $depth++ }
        if ($content[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end = $i; break } }
    }
    Write-Host "===== Store model =====" -ForegroundColor Cyan
    Write-Host $content.Substring($idx1, $end - $idx1 + 1)
}

Write-Host ""
Write-Host "===== Last 700 characters (should show HygienePhoto model) =====" -ForegroundColor Cyan
Write-Host $content.Substring([Math]::Max(0, $content.Length - 700))
