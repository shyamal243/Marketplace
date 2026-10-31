# Fix: href={/orders/${order.id}/invoice} -> href={`/orders/${order.id}/invoice`}
# Run this from the repo root (F:\SEMS website\RM3_C_V2)
# Uses -LiteralPath throughout because "[id]" is a folder name, not a wildcard pattern.

$target = "apps\web\app\orders\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $target)) {
    Write-Host "Could not find: $target" -ForegroundColor Red
    Write-Host "Run this script from the repo root (F:\SEMS website\RM3_C_V2)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Patching: $target"

$content = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $target).Path)

$literalOld = 'href={/orders/${order.id}/invoice}'
$literalNew = 'href={`/orders/${order.id}/invoice`}'

if ($content.Contains($literalOld)) {
    $newContent = $content.Replace($literalOld, $literalNew)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $target).Path, $newContent, $utf8NoBom)
    Write-Host "Fixed: added backticks around the invoice link template literal." -ForegroundColor Green
} else {
    Write-Host "Exact pattern not found. Showing every line that mentions 'invoice' so we can see the real text:" -ForegroundColor Yellow
    $lines = [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $target).Path)
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'invoice') {
            Write-Host ("Line {0}: {1}" -f ($i + 1), $lines[$i])
        }
    }
}
