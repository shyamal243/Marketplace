$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$backupPath = "$path.bak"
Copy-Item $path $backupPath -Force
Write-Host "Backed up contract.prisma to contract.prisma.bak"

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

# Remove the Store back-reference line
$content = $content.Replace("  hygienePhotos          HygienePhoto[]`n", "")

# Remove the HygienePhoto model entirely
$modelText = @'
model HygienePhoto {
  id         Int               @id @default(autoincrement())
  store      Store             @relation(fields:[storeId], references:[id])
  storeId    Int
  photoPath  String
  uploadedAt TimestamptzString @default(now())
}
'@
$modelTextN = $modelText.Replace("`r`n", "`n")
$content = $content.Replace("`n" + $modelTextN, "")
$content = $content.Replace($modelTextN, "")

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)

Write-Host ""
Write-Host "Removed HygienePhoto references. Now testing contract emit (from apps/api)..." -ForegroundColor Cyan
Write-Host "Run: cd apps\api ; pnpm prisma contract emit ; cd ..\.." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANT: after testing, restore with:" -ForegroundColor Yellow
Write-Host "  Copy-Item `"$backupPath`" `"$path`" -Force" -ForegroundColor Yellow
