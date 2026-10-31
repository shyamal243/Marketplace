$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw
$idx = $content.IndexOf("model User")
if ($idx -ge 0) {
    # Find the end of the User model block by counting braces
    $start = $content.IndexOf("{", $idx)
    $depth = 0
    $end = $start
    for ($i = $start; $i -lt $content.Length; $i++) {
        if ($content[$i] -eq '{') { $depth++ }
        if ($content[$i] -eq '}') { $depth--; if ($depth -eq 0) { $end = $i; break } }
    }
    Write-Host $content.Substring($idx, $end - $idx + 1)
} else {
    Write-Host "(model User not found)"
}
