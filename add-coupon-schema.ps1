$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

# ---- Edit 1: back-reference on User ----
$old1 = @'
  favorites              Favorite[]
'@

$new1 = @'
  favorites              Favorite[]
  couponRedemptions      CouponRedemption[]
'@

# ---- Edit 2: append new models at end of file ----
$old2 = @'
model Task {
  id               Int               @id @default(autoincrement())
  assignedTo       User              @relation("AssignedTasks", fields:[assignedToId], references:[id])
  assignedToId     Int
  createdByAdmin   User              @relation("CreatedTasks", fields:[createdByAdminId], references:[id])
  createdByAdminId Int
  taskType         String
  relatedUserId    Int?
  title            String
  description      String?
  status           String            @default("pending")
  notes            String?
  createdAt        TimestamptzString @default(now())
  updatedAt        TimestamptzString @default(now())
}
'@

$new2 = @'
model Task {
  id               Int               @id @default(autoincrement())
  assignedTo       User              @relation("AssignedTasks", fields:[assignedToId], references:[id])
  assignedToId     Int
  createdByAdmin   User              @relation("CreatedTasks", fields:[createdByAdminId], references:[id])
  createdByAdminId Int
  taskType         String
  relatedUserId    Int?
  title            String
  description      String?
  status           String            @default("pending")
  notes            String?
  createdAt        TimestamptzString @default(now())
  updatedAt        TimestamptzString @default(now())
}

model Coupon {
  id             Int                @id @default(autoincrement())
  code           String             @unique
  description    String?
  rewardType     String // "discount" or "cashback"
  valueType      String // "flat" or "percent"
  value          Int
  maxDiscount    Int?
  minOrderAmount Int?
  usageLimit     Int?
  usedCount      Int                @default(0)
  perUserLimit   Int?               @default(1)
  isActive       Boolean            @default(true)
  expiresAt      TimestamptzString?
  redemptions    CouponRedemption[]
  createdAt      TimestamptzString  @default(now())
}

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

$content = Apply-Edit $content $old1 $new1 "User back-reference"
$content = Apply-Edit $content $old2 $new2 "new Coupon/CouponRedemption models"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing contract.prisma. Check above for any FAILED lines." -ForegroundColor Cyan
