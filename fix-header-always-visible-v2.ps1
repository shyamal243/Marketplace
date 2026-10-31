$path = "apps\web\app\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

# Step 1: remove the hamburger <button>...</button> block via regex (tolerant of the
# emoji characters inside it, which can get mangled between systems). Anchored on the
# onClick line, which is plain ASCII and unique in the file.
$pattern = '(?s)        <button\n          onClick=\{\(\) => setMobileMenuOpen\(!mobileMenuOpen\)\}\n.*?</button>\n'
$regex = New-Object System.Text.RegularExpressions.Regex($pattern)
$match = $regex.Match($content)
if ($match.Success) {
    Write-Host "Applied: removed hamburger button block" -ForegroundColor Green
    $content = $regex.Replace($content, "", 1)
} else {
    Write-Host "FAILED to find hamburger button block" -ForegroundColor Red
}

# Step 2: replace the hidden/flex toggle div with an always-visible flex-wrap bar.
$old2 = '        <div className={`${mobileMenuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full z-10 flex-col gap-3 border-b border-rv-border bg-rv-bg p-4 md:static md:z-auto md:flex md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0`}>'
$new2 = '        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">'
if ($content.Contains($old2)) {
    Write-Host "Applied: always-visible account-links bar" -ForegroundColor Green
    $content = $content.Replace($old2, $new2)
} else {
    Write-Host "FAILED to find the account-links div" -ForegroundColor Red
}

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
