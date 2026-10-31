$path = "apps\web\app\demands\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)
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

# 1. Bid interface + new MyProduct interface
$old1 = @'
interface Bid {
  id: number;
  amount: number;
  message: string | null;
  status: string;
  sellerId: number;
}
'@
$new1 = @'
interface MyProduct {
  id: number;
  name: string;
  price: number;
  storeId: number;
}

interface Bid {
  id: number;
  amount: number;
  message: string | null;
  status: string;
  sellerId: number;
  linkedProductId: number | null;
  linkedProduct: MyProduct | null;
}
'@
$content = Apply-Edit $content $old1 $new1 "MyProduct interface + Bid.linkedProduct fields"

# 2. state
$old2 = @'
  const [submitting, setSubmitting] = useState(false);
'@
$new2 = @'
  const [submitting, setSubmitting] = useState(false);
  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
'@
$content = Apply-Edit $content $old2 $new2 "myProducts state"

# 3. new effect to load seller's own products
$old3 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    loadData();
  }, [id]);
'@
$new3 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    loadData();
  }, [id]);

  useEffect(() => {
    if (user && user.role === "seller") {
      loadMyProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadMyProducts() {
    try {
      const data = await apiFetch("/products/mine");
      setMyProducts(data);
    } catch {
      // not critical to the page - just means no product picker is shown
    }
  }
'@
$content = Apply-Edit $content $old3 $new3 "loadMyProducts effect + function"

# 4. handleBidSubmit: include productId, reset selectedProductId
$old4 = @'
    try {
      await apiFetch("/bids", {
        method: "POST",
        body: JSON.stringify({
          demandId: Number(id),
          amount: Number(bidAmount),
          message: bidMessage || undefined,
        }),
      });
      setBidAmount("");
      setBidMessage("");
      await loadData();
'@
$new4 = @'
    try {
      await apiFetch("/bids", {
        method: "POST",
        body: JSON.stringify({
          demandId: Number(id),
          amount: Number(bidAmount),
          message: bidMessage || undefined,
          productId: selectedProductId ? Number(selectedProductId) : undefined,
        }),
      });
      setBidAmount("");
      setBidMessage("");
      setSelectedProductId("");
      await loadData();
'@
$content = Apply-Edit $content $old4 $new4 "include productId in bid submit"

# 5. product picker dropdown in the bid form
$old5 = @'
              <textarea
                rows={2}
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder="Message (optional)"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <button
                type="submit"
                disabled={submitting}
'@
$new5 = @'
              <textarea
                rows={2}
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder="Message (optional)"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              {myProducts.length > 0 && (
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="">Link one of your products (optional)</option>
                  {myProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ₹{p.price}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={submitting}
'@
$content = Apply-Edit $content $old5 $new5 "product picker dropdown"

# 6. show linked product on the buyer's bid card
$old6 = @'
                  {bid.message && (
                    <p className="mt-2 font-body text-sm text-rv-text-dim">{bid.message}</p>
                  )}
                  {bid.status === "pending" && (
'@
$new6 = @'
                  {bid.message && (
                    <p className="mt-2 font-body text-sm text-rv-text-dim">{bid.message}</p>
                  )}
                  {bid.linkedProduct && (
                    <a
                      href={`/stores/${bid.linkedProduct.storeId}`}
                      className="mt-2 inline-block rounded-md border border-rv-cyan/30 bg-rv-cyan/10 px-3 py-1.5 font-body text-xs text-rv-cyan transition hover:bg-rv-cyan/20"
                    >
                      Linked product: {bid.linkedProduct.name} (₹{bid.linkedProduct.price}) - view in store →
                    </a>
                  )}
                  {bid.status === "pending" && (
'@
$content = Apply-Edit $content $old6 $new6 "linked product display on bid card"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing demands/[id]/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
