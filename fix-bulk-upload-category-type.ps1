$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
      const name = row.name ? String(row.name).trim() : "";
      const description = row.description ? String(row.description).trim() : undefined;
      const category = row.category ? String(row.category).trim() : undefined;
'@

$new = @'
      const name = row.name ? String(row.name).trim() : "";
      const description = row.description ? String(row.description).trim() : undefined;
      const category: string | null = row.category ? String(row.category).trim() : null;
'@

$oldNormalized = $old.Replace("`r`n", "`n")
$newNormalized = $new.Replace("`r`n", "`n")

if ($content.Contains($oldNormalized)) {
    $updated = $content.Replace($oldNormalized, $newNormalized)
    if ($hadCrLf) {
        $updated = $updated.Replace("`n", "`r`n")
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $updated, $utf8NoBom)
    Write-Host "Fixed: category now uses null instead of undefined to match the Product schema type." -ForegroundColor Green
} else {
    Write-Host "Anchor text not found. Showing current text for comparison:" -ForegroundColor Red
    $idx = $content.IndexOf('const name = row.name')
    if ($idx -ge 0) {
        Write-Host $content.Substring($idx, [Math]::Min(400, $content.Length - $idx))
    }
}
