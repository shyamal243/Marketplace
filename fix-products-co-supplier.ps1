$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
    if (req.userRole !== "seller") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, category, price, stock } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: "storeId is required" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store || store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }
'@

$new = @'
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, category, price, stock } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: "storeId is required" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }
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
    Write-Host "Fixed: co-suppliers with StoreAccess can now add products to the store they were granted access to." -ForegroundColor Green
} else {
    Write-Host "Anchor text not found. Showing current text around 'Only sellers can add products' for comparison:" -ForegroundColor Red
    $idx = $content.IndexOf('Only sellers can add products')
    if ($idx -ge 0) {
        Write-Host $content.Substring([Math]::Max(0, $idx - 200), [Math]::Min(1400, $content.Length - $idx))
    }
}
