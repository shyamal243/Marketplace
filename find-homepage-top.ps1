$path = "apps\web\app\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$lines = $content -split "`n"
Write-Host "Total lines: $($lines.Count)"
Write-Host ""
$take = [Math]::Min(180, $lines.Count)
Write-Host ($lines[0..($take-1)] -join "`n")
