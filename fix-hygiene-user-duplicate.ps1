$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

# Find the User model block specifically and remove the erroneous hygienePhotos line from within it only
$userIdx = $content.IndexOf("model User")
if ($userIdx -eq -1) {
    Write-Host "Could not find model User" -ForegroundColor Red
    exit 1
}
$start = $content.IndexOf("{", $userIdx)
$depth = 0
$end = $start
for ($i = $start; $i -lt $content.Length; $i++) {
    if ($content[$i] -eq '{') { $depth++ }
    if ($content[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end = $i; break } }
}

$userBlock = $content.Substring($userIdx, $end - $userIdx + 1)

if ($userBlock -match 'hygienePhotos\s+HygienePhoto\[\]\n') {
    $fixedUserBlock = $userBlock -replace '  hygienePhotos\s+HygienePhoto\[\]\n', ''
    $content = $content.Substring(0, $userIdx) + $fixedUserBlock + $content.Substring($end + 1)
    if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
    Write-Host "Fixed: removed the erroneous hygienePhotos field from the User model." -ForegroundColor Green
} else {
    Write-Host "Did not find hygienePhotos inside the User model - showing User model as-is:" -ForegroundColor Yellow
    Write-Host $userBlock
}
