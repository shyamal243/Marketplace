$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const { amount } = req.body;
'@
$new = @'
app.get("/co-admin/benchmarks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const products = await db.orm.public.Product.where({ isActive: true }).all();
    const stores = await db.orm.public.Store.where({}).all();
    const ratings = await db.orm.public.ProductRating.where({}).all();
    const orderItems = await db.orm.public.OrderItem.where({}).all();

    const storeNameById = new Map<number, string>();
    stores.forEach((s: any) => storeNameById.set(s.id, s.name));

    const ratingsByProduct = new Map<number, number[]>();
    ratings.forEach((r: any) => {
      const list = ratingsByProduct.get(r.productId) || [];
      list.push(r.rating);
      ratingsByProduct.set(r.productId, list);
    });

    const unitsByProduct = new Map<number, number>();
    orderItems.forEach((item: any) => {
      unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) || 0) + item.quantity);
    });

    const categoryMap = new Map<string, any[]>();
    products.forEach((p: any) => {
      const category = p.category || "uncategorized";
      const list = categoryMap.get(category) || [];
      list.push(p);
      categoryMap.set(category, list);
    });

    const categories = Array.from(categoryMap.entries()).map(([category, categoryProducts]) => {
      const prices = categoryProducts.map((p: any) => p.price);
      const storeIds = new Set(categoryProducts.map((p: any) => p.storeId));

      const storeGroups = new Map<number, any[]>();
      categoryProducts.forEach((p: any) => {
        const list = storeGroups.get(p.storeId) || [];
        list.push(p);
        storeGroups.set(p.storeId, list);
      });

      const storeBreakdown = Array.from(storeGroups.entries()).map(([storeId, storeProducts]) => {
        const storePrices = storeProducts.map((p: any) => p.price);
        const allRatings: number[] = [];
        let unitsSold = 0;

        storeProducts.forEach((p: any) => {
          const productRatings = ratingsByProduct.get(p.id) || [];
          allRatings.push(...productRatings);
          unitsSold += unitsByProduct.get(p.id) || 0;
        });

        const avgRating =
          allRatings.length > 0 ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length : null;

        return {
          storeId,
          storeName: storeNameById.get(storeId) || `Store #${storeId}`,
          productCount: storeProducts.length,
          avgPrice: Math.round(storePrices.reduce((sum: number, price: number) => sum + price, 0) / storePrices.length),
          avgRating,
          unitsSold,
        };
      });

      storeBreakdown.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));

      return {
        category,
        productCount: categoryProducts.length,
        storeCount: storeIds.size,
        avgPrice: Math.round(prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        stores: storeBreakdown,
      };
    });

    categories.sort((a, b) => b.productCount - a.productCount);

    res.status(200).json({ categories });
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

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $content = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
    Write-Host "Added: GET /co-admin/benchmarks route" -ForegroundColor Green
} else {
    Write-Host "Anchor not found." -ForegroundColor Red
}
