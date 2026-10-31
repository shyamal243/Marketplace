$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
model HygienePhoto {
  id         Int               @id @default(autoincrement())
  store      Store             @relation(fields:[storeId], references:[id])
  storeId    Int
  photoPath  String
  uploadedAt TimestamptzString @default(now())
}
'@

$new = @'
model HygienePhoto {
  id         Int               @id @default(autoincrement())
  store      Store             @relation(fields:[storeId], references:[id])
  storeId    Int
  photoPath  String
  uploadedAt TimestamptzString @default(now())
}

model RiskFlag {
  id         Int               @id @default(autoincrement())
  entityType String // "user" or "order"
  entityId   Int
  reason     String
  severity   String // "low", "medium", "high"
  resolved   Boolean           @default(false)
  createdAt  TimestamptzString @default(now())
}
'@

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $updated = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $updated = $updated.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $updated, $utf8NoBom)
    Write-Host "Added: RiskFlag model (no relations - standalone table)" -ForegroundColor Green
} else {
    Write-Host "Anchor not found." -ForegroundColor Red
}
