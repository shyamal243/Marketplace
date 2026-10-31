$path = "apps\api\src\prisma\contract.prisma"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
  printPricePerPageBw    Int?
  printPricePerPageColor Int?
  isActive               Boolean           @default(true)
'@
$new = @'
  printPricePerPageBw    Int?
  printPricePerPageColor Int?
  fssaiLicenseNumber     String?
  businessRegistrationNumber String?
  isActive               Boolean           @default(true)
'@

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $content = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
    Write-Host "Added: Store.fssaiLicenseNumber and Store.businessRegistrationNumber" -ForegroundColor Green
} else {
    Write-Host "Anchor not found." -ForegroundColor Red
}
