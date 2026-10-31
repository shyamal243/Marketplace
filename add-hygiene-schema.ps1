$path = "apps\api\src\prisma\contract.prisma"
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

# 1. back-reference on Store
$old1 = @'
  storeAccesses          StoreAccess[]
'@
$new1 = @'
  storeAccesses          StoreAccess[]
  hygienePhotos          HygienePhoto[]
'@
$content = Apply-Edit $content $old1 $new1 "Store back-reference"

# 2. append new model at end of file (after CouponRedemption, the current last model)
$old2 = @'
model CouponRedemption {
  id        Int               @id @default(autoincrement())
  coupon    Coupon            @relation(fields:[couponId], references:[id])
  couponId  Int
  user      User              @relation(fields:[userId], references:[id])
  userId    Int
  orderId   Int
  amount    Int
  createdAt TimestamptzString @default(now())
}
'@
$new2 = @'
model CouponRedemption {
  id        Int               @id @default(autoincrement())
  coupon    Coupon            @relation(fields:[couponId], references:[id])
  couponId  Int
  user      User              @relation(fields:[userId], references:[id])
  userId    Int
  orderId   Int
  amount    Int
  createdAt TimestamptzString @default(now())
}

model HygienePhoto {
  id         Int               @id @default(autoincrement())
  store      Store             @relation(fields:[storeId], references:[id])
  storeId    Int
  photoPath  String
  uploadedAt TimestamptzString @default(now())
}
'@
$content = Apply-Edit $content $old2 $new2 "new HygienePhoto model"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing contract.prisma. Check above for any FAILED lines." -ForegroundColor Cyan
