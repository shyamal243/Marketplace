$path = "apps\web\app\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$lines = $content -split "`n"

$startIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "return \(") { $startIdx = $i; break }
}

$endMarker = -1
for ($i = $startIdx; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "activeTab === .postdemand.") { $endMarker = $i; break }
}

Write-Host "return( at line $startIdx, postdemand tab starts at line $endMarker"
Write-Host ""
Write-Host ($lines[$startIdx..($endMarker)] -join "`n")
