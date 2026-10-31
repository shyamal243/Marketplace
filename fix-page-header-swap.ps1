$path = "apps\web\app\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$startAnchor = '      <header className="relative flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">'
$endAnchor = '</header>'

$pattern = [System.Text.RegularExpressions.Regex]::Escape($startAnchor) + '(?s).*?' + [System.Text.RegularExpressions.Regex]::Escape($endAnchor)
$regex = New-Object System.Text.RegularExpressions.Regex($pattern)
$match = $regex.Match($content)

if ($match.Success) {
    Write-Host "Applied: replace inline header with shared <Header /> (regex match)" -ForegroundColor Green
    $content = $regex.Replace($content, "      <Header />", 1)
} else {
    Write-Host "FAILED to find the header block (regex)" -ForegroundColor Red
}

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
