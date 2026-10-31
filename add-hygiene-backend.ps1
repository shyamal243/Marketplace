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

# 1. declare hasFood
$old1 = @'
    let subtotal = 0;
    let hasJewellery = false;
    const validatedItems: { productId: number; quantity: number; priceAtPurchase: number }[] = [];
'@
$new1 = @'
    let subtotal = 0;
    let hasJewellery = false;
    let hasFood = false;
    const validatedItems: { productId: number; quantity: number; priceAtPurchase: number }[] = [];
'@
$content = Apply-Edit $content $old1 $new1 "declare hasFood flag"

# 2. detect food + gate on hygiene status
$old2 = @'
      subtotal += product.price * quantity;
      validatedItems.push({ productId, quantity, priceAtPurchase: product.price });
      if (product.category === "jewellery") hasJewellery = true;
    }

    const { couponCode } = req.body;
'@
$new2 = @'
      subtotal += product.price * quantity;
      validatedItems.push({ productId, quantity, priceAtPurchase: product.price });
      if (product.category === "jewellery") hasJewellery = true;
      if (product.category === "food") hasFood = true;
    }

    if (hasFood) {
      const foodPhotos = await db.orm.public.HygienePhoto.where({ storeId: store.id }).all();
      let latestFoodPhoto: { uploadedAt: string } | null = null;
      for (const p of foodPhotos) {
        if (!latestFoodPhoto || new Date(p.uploadedAt) > new Date(latestFoodPhoto.uploadedAt)) {
          latestFoodPhoto = p;
        }
      }
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hygieneCurrent = latestFoodPhoto ? new Date(latestFoodPhoto.uploadedAt) > twentyFourHoursAgo : false;

      if (!hygieneCurrent) {
        return res.status(400).json({ error: "This store has not uploaded today's kitchen hygiene photo yet. Food orders cannot be placed until they do." });
      }
    }

    const { couponCode } = req.body;
'@
$content = Apply-Edit $content $old2 $new2 "hygiene gate on food checkout"

# 3. new routes: upload + status
$old3 = @'
app.get("/products/bulk-upload/template", requireAuth, async (req: AuthRequest, res) => {
'@
$new3 = @'
app.post("/stores/:id/hygiene-photo", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can upload a hygiene photo" });
    }

    const storeId = Number(req.params.id);
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: "Please attach a photo" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      fs.unlink(photoFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(photoFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const photo = await db.orm.public.HygienePhoto.create({
      storeId: store.id,
      photoPath: photoFile.path,
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/hygiene-status", async (req, res) => {
  try {
    const storeId = Number(req.params.id);

    const photos = await db.orm.public.HygienePhoto.where({ storeId }).all();

    let latest: { uploadedAt: string } | null = null;
    for (const p of photos) {
      if (!latest || new Date(p.uploadedAt) > new Date(latest.uploadedAt)) {
        latest = p;
      }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const uploadedToday = latest ? new Date(latest.uploadedAt) > twentyFourHoursAgo : false;

    res.status(200).json({ uploadedToday, latestUploadedAt: latest ? latest.uploadedAt : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products/bulk-upload/template", requireAuth, async (req: AuthRequest, res) => {
'@
$content = Apply-Edit $content $old3 $new3 "hygiene-photo upload + status routes"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
