$path = "apps\api\prisma.config.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
'@

$new = @'
const prismaConfig: ReturnType<typeof definePrismaConfig> = definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});

export default prismaConfig;
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
    Write-Host "Fixed: prisma.config.ts now has an explicit type, silencing the TS2883 warning." -ForegroundColor Green
} else {
    Write-Host "Anchor text not found. Current file content:" -ForegroundColor Red
    Write-Host $content
}
