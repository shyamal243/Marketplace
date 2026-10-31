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

# 1. Bid model: add linkedProduct relation
$old1 = @'
model Bid {
  id        Int               @id @default(autoincrement())
  amount    Int
  message   String?
  status    String            @default("pending") // "pending", "accepted", "rejected"
  demand    Demand            @relation(fields:[demandId], references:[id])
  demandId  Int
  seller    User              @relation(fields:[sellerId], references:[id])
  sellerId  Int
  createdAt TimestamptzString @default(now())
  updatedAt TimestamptzString @default(now())
}
'@
$new1 = @'
model Bid {
  id              Int               @id @default(autoincrement())
  amount          Int
  message         String?
  status          String            @default("pending") // "pending", "accepted", "rejected"
  demand          Demand            @relation(fields:[demandId], references:[id])
  demandId        Int
  seller          User              @relation(fields:[sellerId], references:[id])
  sellerId        Int
  linkedProduct   Product?          @relation(fields:[linkedProductId], references:[id])
  linkedProductId Int?
  createdAt       TimestamptzString @default(now())
  updatedAt       TimestamptzString @default(now())
}
'@
$content = Apply-Edit $content $old1 $new1 "Bid.linkedProduct relation"

# 2. Product model: back-reference array field
$old2 = @'
model Product {
  id          Int               @id @default(autoincrement())
  name        String
  description String?
  category    String?
  price       Int
  stock       Int               @default(0)
  isActive    Boolean           @default(true)
  store       Store             @relation(fields:[storeId], references:[id])
  storeId     Int
  orderItems  OrderItem[]
  favoritedBy Favorite[]
  ratings     ProductRating[]
  createdAt   TimestamptzString @default(now())
  updatedAt   TimestamptzString @default(now())
}
'@
$new2 = @'
model Product {
  id           Int               @id @default(autoincrement())
  name         String
  description  String?
  category     String?
  price        Int
  stock        Int               @default(0)
  isActive     Boolean           @default(true)
  store        Store             @relation(fields:[storeId], references:[id])
  storeId      Int
  orderItems   OrderItem[]
  favoritedBy  Favorite[]
  ratings      ProductRating[]
  linkedInBids Bid[]
  createdAt    TimestamptzString @default(now())
  updatedAt    TimestamptzString @default(now())
}
'@
$content = Apply-Edit $content $old2 $new2 "Product.linkedInBids back-reference"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing contract.prisma. Check above for any FAILED lines." -ForegroundColor Cyan
