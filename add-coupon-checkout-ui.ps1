$path = "apps\web\app\stores\[id]\page.tsx"
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

# 1. state
$old1 = @'
const [cart, setCart] = useState<Record<number, number>>({});
'@
$new1 = @'
const [cart, setCart] = useState<Record<number, number>>({});
  const [couponCode, setCouponCode] = useState("");
'@
$content = Apply-Edit $content $old1 $new1 "coupon code state"

# 2. handleCheckout
$old2 = @'
  async function handleCheckout() {
    setError("");
    setMessage("");
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }));

    if (items.length === 0) {
      setError("Add at least one item to your order.");
      return;
    }

    try {
      const order = await apiFetch("/store-orders", {
        method: "POST",
        body: JSON.stringify({ storeId: Number(id), items }),
      });
      setMessage(`Order placed! Order #${order.id} - Total Rs.${order.totalAmount}`);
      setCart({});
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }
'@
$new2 = @'
  async function handleCheckout() {
    setError("");
    setMessage("");
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }));

    if (items.length === 0) {
      setError("Add at least one item to your order.");
      return;
    }

    try {
      const order = await apiFetch("/store-orders", {
        method: "POST",
        body: JSON.stringify({ storeId: Number(id), items, couponCode: couponCode || undefined }),
      });
      const couponNote = order.couponApplied
        ? order.couponApplied.rewardType === "cashback"
          ? ` (coupon ${order.couponApplied.code} credited Rs.${order.couponApplied.amount} cashback)`
          : ` (coupon ${order.couponApplied.code} saved Rs.${order.couponApplied.amount})`
        : "";
      setMessage(`Order placed! Order #${order.id} - Total Rs.${order.totalAmount}${couponNote}`);
      setCart({});
      setCouponCode("");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }
'@
$content = Apply-Edit $content $old2 $new2 "handleCheckout uses coupon code"

# 3. JSX
$old3 = @'
        {isCustomer && products.length > 0 && (
          <button
            onClick={handleCheckout}
            className="mt-6 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
          >
            Place order
          </button>
        )}
'@
$new3 = @'
        {isCustomer && products.length > 0 && (
          <div className="mt-6">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Coupon code (optional)"
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
            />
            <button
              onClick={handleCheckout}
              className="mt-3 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
            >
              Place order
            </button>
          </div>
        )}
'@
$content = Apply-Edit $content $old3 $new3 "coupon input JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing stores/[id]/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
