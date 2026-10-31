$path = "apps\web\app\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$lines = $content -split "`r?`n"

$startIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "setMobileMenuOpen\(!mobileMenuOpen\)") { $startIdx = $i - 1; break }
}

if ($startIdx -lt 0) {
    Write-Host "Could not find the hamburger button line at all." -ForegroundColor Red
    exit 1
}

Write-Host "Found near line $startIdx"
Write-Host ""
$endIdx = [Math]::Min($startIdx + 12, $lines.Count - 1)
for ($i = $startIdx; $i -le $endIdx; $i++) {
    Write-Host "[$i] $($lines[$i])"
}
