$path = "apps\api\src\index.ts"
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

# 1. Public GET /stores/:id route + POST /stores/:id/license-info, inserted before GET /stores/:id/products
$old1 = @'
app.get("/stores/:id/products", async (req, res) => {
'@
$new1 = @'
app.get("/stores/:id", async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.status(200).json({
      id: store.id,
      name: store.name,
      address: store.address,
      isActive: store.isActive,
      offersPrintService: store.offersPrintService,
      printPricePerPageBw: store.printPricePerPageBw,
      printPricePerPageColor: store.printPricePerPageColor,
      fssaiLicenseNumber: store.fssaiLicenseNumber,
      businessRegistrationNumber: store.businessRegistrationNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores/:id/license-info", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { fssaiLicenseNumber, businessRegistrationNumber } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const hasAccess =
      store.sellerId === req.userId ||
      (await db.orm.public.StoreAccess.where({ storeId, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      businessRegistrationNumber: businessRegistrationNumber || null,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/products", async (req, res) => {
'@
$content = Apply-Edit $content $old1 $new1 "GET /stores/:id and POST /stores/:id/license-info"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
