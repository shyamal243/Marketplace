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

# 1. New GET /products/mine route, inserted right before POST /products
$old1 = @'
app.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }
'@
$new1 = @'
app.get("/products/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can view their own products" });
    }

    const ownedStores = await db.orm.public.Store.where({ sellerId: req.userId! }).all();
    const accessEntries = await db.orm.public.StoreAccess.where({ userId: req.userId! }).all();

    const storeIds = new Set<number>();
    ownedStores.forEach((s: any) => storeIds.add(s.id));
    accessEntries.forEach((a: any) => storeIds.add(a.storeId));

    const productsByStore = await Promise.all(
      Array.from(storeIds).map((storeId) => db.orm.public.Product.where({ storeId, isActive: true }).all())
    );

    res.status(200).json(productsByStore.flat());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }
'@
$content = Apply-Edit $content $old1 $new1 "GET /products/mine route"

# 2. POST /bids: accept optional productId and validate ownership
$old2 = @'
app.post("/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { demandId, amount, message } = req.body;
        if (req.userRole !== "seller" && req.userRole !== "professional") {
      return res.status(403).json({ error: "Only sellers or professionals can submit bids" });
    }
        if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // STEP 1: Look up the demand FIRST (new)
    const targetDemand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!targetDemand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    // STEP 2: Check if the bidding deadline has passed (new)
    if (targetDemand.bidWindowExpiresAt && new Date(targetDemand.bidWindowExpiresAt) < new Date()) {
      return res.status(400).json({ error: "The bidding window for this demand has closed" });
    }
    if (targetDemand.status !== "open") {
      return res.status(400).json({ error: `Cannot bid on a demand with status "${targetDemand.status}"` });
    }
    // STEP 3: Only now do we create the bid (same as before)
    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
    });
'@
$new2 = @'
app.post("/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { demandId, amount, message, productId } = req.body;
        if (req.userRole !== "seller" && req.userRole !== "professional") {
      return res.status(403).json({ error: "Only sellers or professionals can submit bids" });
    }
        if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // STEP 1: Look up the demand FIRST (new)
    const targetDemand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!targetDemand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    // STEP 2: Check if the bidding deadline has passed (new)
    if (targetDemand.bidWindowExpiresAt && new Date(targetDemand.bidWindowExpiresAt) < new Date()) {
      return res.status(400).json({ error: "The bidding window for this demand has closed" });
    }
    if (targetDemand.status !== "open") {
      return res.status(400).json({ error: `Cannot bid on a demand with status "${targetDemand.status}"` });
    }

    let linkedProductId: number | null = null;

    if (productId !== undefined && productId !== null) {
      const linkedProduct = await db.orm.public.Product.where({ id: productId }).first();

      if (!linkedProduct) {
        return res.status(404).json({ error: "Linked product not found" });
      }

      const productStore = await db.orm.public.Store.where({ id: linkedProduct.storeId }).first();
      const isOwner = productStore?.sellerId === req.userId;
      const hasAccess =
        isOwner ||
        (await db.orm.public.StoreAccess.where({ storeId: linkedProduct.storeId, userId: req.userId! }).first()) !== null;

      if (!hasAccess) {
        return res.status(403).json({ error: "You can only link a product from your own store" });
      }

      linkedProductId = linkedProduct.id;
    }

    // STEP 3: Only now do we create the bid (same as before)
    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
      linkedProductId,
    });
'@
$content = Apply-Edit $content $old2 $new2 "POST /bids linked product support"

# 3. GET /demands/:id/bids: enrich with linked product details
$old3 = @'
app.get("/demands/:id/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    const allBids = await db.orm.public.Bid.where({ demandId }).all();

    if (demand.buyerId === req.userId) {
      return res.status(200).json(allBids);
    }

    const ownBidOnly = allBids.filter((b) => b.sellerId === req.userId);
    res.status(200).json(ownBidOnly);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
'@
$new3 = @'
app.get("/demands/:id/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    const allBids = await db.orm.public.Bid.where({ demandId }).all();

    const linkedProductIds = Array.from(
      new Set(allBids.map((b: any) => b.linkedProductId).filter((id: any) => id !== null && id !== undefined))
    );

    const linkedProducts = await Promise.all(
      linkedProductIds.map((productId: number) => db.orm.public.Product.where({ id: productId }).first())
    );

    const productById = new Map<number, any>();
    linkedProducts.forEach((p: any) => {
      if (p) productById.set(p.id, p);
    });

    const enrichedBids = allBids.map((b: any) => ({
      ...b,
      linkedProduct: b.linkedProductId ? productById.get(b.linkedProductId) ?? null : null,
    }));

    if (demand.buyerId === req.userId) {
      return res.status(200).json(enrichedBids);
    }

    const ownBidOnly = enrichedBids.filter((b: any) => b.sellerId === req.userId);
    res.status(200).json(ownBidOnly);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
'@
$content = Apply-Edit $content $old3 $new3 "GET /demands/:id/bids enrich with linked product"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
