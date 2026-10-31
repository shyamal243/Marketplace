$path = "apps\web\app\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$lines = $content -split "`r?`n"

$startIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "async function handleLogout") { $startIdx = $i; break }
}
if ($startIdx -lt 0) {
    Write-Host "Could not find handleLogout" -ForegroundColor Red
    exit 1
}
$endIdx = [Math]::Min($startIdx + 20, $lines.Count - 1)
for ($i = $startIdx; $i -le $endIdx; $i++) {
    Write-Host "[$i] $($lines[$i])"
}
