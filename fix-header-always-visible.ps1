$path = "apps\web\app\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

function Apply-Edit {
    param($content, $old, $new, $label)
    $oldN = $old.Replace("`r`n", "`n")
    $newN = $new.Replace("`r`n", "`n")
    if ($content.Contains($oldN)) {
        Write-Host "Applied: $label" -ForegroundColor Green
        return $content.Replace($oldN, $newN)
    } else {
        Write-Host "FAILED to find anchor for: $label" -ForegroundColor Red
        return $content
    }
}

# Remove the hamburger button + hidden/flex toggle wrapper; always show the account-links bar,
# letting it wrap onto a second line on narrow screens instead of disappearing.
$old1 = @'
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md border border-rv-border p-2 font-body text-rv-text md:hidden"
          aria-label="Menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
        <div className={`${mobileMenuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full z-10 flex-col gap-3 border-b border-rv-border bg-rv-bg p-4 md:static md:z-auto md:flex md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0`}>
'@
$new1 = @'
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
'@
$content = Apply-Edit $content $old1 $new1 "always-visible account-links bar (remove hamburger toggle)"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
