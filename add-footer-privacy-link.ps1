$path = "apps\web\app\Footer.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
          <Link href="/legal/privacy" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            Privacy
          </Link>
'@
$new = @'
          <Link href="/legal/privacy" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            Privacy
          </Link>
          <Link href="/account/privacy" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            My Data
          </Link>
'@

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $content = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
    Write-Host "Added: My Data link to footer" -ForegroundColor Green
} else {
    Write-Host "Anchor not found." -ForegroundColor Red
}
