$pagePath = "apps\web\app\stores\[id]\page.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $pagePath).Path)

Write-Host "=== isManager definition ===" -ForegroundColor Cyan
$idx = $content.IndexOf("isManager")
if ($idx -ge 0) {
    Write-Host $content.Substring([Math]::Max(0,$idx-100), 300)
}

Write-Host ""
Write-Host "=== header area (Store #id heading through isManager buttons close) ===" -ForegroundColor Cyan
$idx2 = $content.IndexOf('<h1 className="font-display text-3xl')
if ($idx2 -ge 0) {
    Write-Host $content.Substring($idx2, 1200)
}

Write-Host ""
Write-Host "=== print-settings form JSX block ===" -ForegroundColor Cyan
$idx3 = $content.IndexOf('handleSavePrintSettings} className')
if ($idx3 -ge 0) {
    $start3 = [Math]::Max(0, $idx3 - 300)
    $end3 = $content.IndexOf("</form>", $idx3) + 8
    Write-Host $content.Substring($start3, ($end3 - $start3))
}
