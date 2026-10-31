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

# 1. Admin store toggle routes, inserted before /admin/risk-flags
$old1 = @'
app.get("/admin/risk-flags", requireAuth, async (req: AuthRequest, res) => {
'@
$new1 = @'
app.get("/admin/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const stores = await db.orm.public.Store.where({}).all();
    const sellers = await db.orm.public.User.where({}).all();
    const sellerNameById = new Map<number, string>();
    sellers.forEach((u: any) => sellerNameById.set(u.id, u.name));

    const result = stores.map((s: any) => ({
      id: s.id,
      name: s.name,
      sellerId: s.sellerId,
      sellerName: sellerNameById.get(s.sellerId) || `User #${s.sellerId}`,
      isActive: s.isActive,
      offersPrintService: s.offersPrintService,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ isActive: !store.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ offersPrintService: !store.offersPrintService });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/risk-flags", requireAuth, async (req: AuthRequest, res) => {
'@
$content = Apply-Edit $content $old1 $new1 "admin store toggle routes"

# 2. Co-admin store toggle routes, inserted before /co-admin/settings/referral-reward
$old2 = @'
app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const { amount } = req.body;
'@
$new2 = @'
app.get("/co-admin/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const cityUsers = await db.orm.public.User.where({ city: me.city }).all();
    const cityUserIds = new Set(cityUsers.map((u: any) => u.id));
    const sellerNameById = new Map<number, string>();
    cityUsers.forEach((u: any) => sellerNameById.set(u.id, u.name));

    const allStores = await db.orm.public.Store.where({}).all();
    const scopedStores = allStores.filter((s: any) => cityUserIds.has(s.sellerId));

    const result = scopedStores.map((s: any) => ({
      id: s.id,
      name: s.name,
      sellerId: s.sellerId,
      sellerName: sellerNameById.get(s.sellerId) || `User #${s.sellerId}`,
      isActive: s.isActive,
      offersPrintService: s.offersPrintService,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const seller = await db.orm.public.User.where({ id: store.sellerId }).first();

    if (seller?.city !== me.city) {
      return res.status(403).json({ error: "This store is outside your city" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ isActive: !store.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const seller = await db.orm.public.User.where({ id: store.sellerId }).first();

    if (seller?.city !== me.city) {
      return res.status(403).json({ error: "This store is outside your city" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ offersPrintService: !store.offersPrintService });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const { amount } = req.body;
'@
$content = Apply-Edit $content $old2 $new2 "co-admin store toggle routes"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
