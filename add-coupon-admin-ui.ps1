$path = "apps\web\app\admin\page.tsx"
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

# 1. tab type union
$old1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings">("users");'
$new1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons">("users");'
$content = Apply-Edit $content $old1 $new1 "tab type union"

# 2. state additions
$old2 = @'
  const [promoteCity, setPromoteCity] = useState("");
'@
$new2 = @'
  const [promoteCity, setPromoteCity] = useState("");

  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDescription, setCouponDescription] = useState("");
  const [couponRewardType, setCouponRewardType] = useState<"discount" | "cashback">("discount");
  const [couponValueType, setCouponValueType] = useState<"flat" | "percent">("flat");
  const [couponValue, setCouponValue] = useState("");
  const [couponMaxDiscount, setCouponMaxDiscount] = useState("");
  const [couponMinOrder, setCouponMinOrder] = useState("");
  const [couponUsageLimit, setCouponUsageLimit] = useState("");
  const [couponPerUserLimit, setCouponPerUserLimit] = useState("1");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);
'@
$content = Apply-Edit $content $old2 $new2 "coupon state variables"

# 3. tab button array
$old3 = '{(["users", "orders", "kyc", "tasks", "settings"] as const).map((t) => ('
$new3 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons"] as const).map((t) => ('
$content = Apply-Edit $content $old3 $new3 "tab button array"

# 4. lazy-load effect on tab switch
$old4 = @'
useEffect(() => {
    loadAll();
  }, []);
'@
$new4 = @'
useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "coupons") {
      loadCoupons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old4 $new4 "lazy-load useEffect"

# 5. handler functions
$old5 = @'
async function handleSetReferralReward(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings/referral-reward", {
        method: "POST",
        body: JSON.stringify({ amount: Number(referralReward) }),
      });
      setMessage("Referral reward updated.");
      setReferralReward("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }
  if (loading) {
'@
$new5 = @'
async function handleSetReferralReward(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings/referral-reward", {
        method: "POST",
        body: JSON.stringify({ amount: Number(referralReward) }),
      });
      setMessage("Referral reward updated.");
      setReferralReward("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadCoupons() {
    setLoadingCoupons(true);
    setCouponError("");
    try {
      const data = await apiFetch("/admin/coupons");
      setCoupons(data);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoadingCoupons(false);
    }
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError("");
    setCreatingCoupon(true);
    try {
      await apiFetch("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: couponCode,
          description: couponDescription || undefined,
          rewardType: couponRewardType,
          valueType: couponValueType,
          value: Number(couponValue),
          maxDiscount: couponMaxDiscount ? Number(couponMaxDiscount) : undefined,
          minOrderAmount: couponMinOrder ? Number(couponMinOrder) : undefined,
          usageLimit: couponUsageLimit ? Number(couponUsageLimit) : undefined,
          perUserLimit: couponPerUserLimit ? Number(couponPerUserLimit) : undefined,
          expiresAt: couponExpiresAt || undefined,
        }),
      });
      setCouponCode("");
      setCouponDescription("");
      setCouponValue("");
      setCouponMaxDiscount("");
      setCouponMinOrder("");
      setCouponUsageLimit("");
      setCouponPerUserLimit("1");
      setCouponExpiresAt("");
      await loadCoupons();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingCoupon(false);
    }
  }

  async function handleToggleCoupon(couponId: number) {
    setCouponError("");
    try {
      await apiFetch(`/admin/coupons/${couponId}/toggle`, { method: "POST" });
      await loadCoupons();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
'@
$content = Apply-Edit $content $old5 $new5 "coupon handler functions"

# 6. JSX tab content
$old6 = @'
        {tab === "users" && (
'@
$new6 = @'
        {tab === "coupons" && (
          <div className="mt-6 flex flex-col gap-4">
            <form onSubmit={handleCreateCoupon} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">Create a coupon</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Code (e.g. WELCOME50)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="text"
                  value={couponDescription}
                  onChange={(e) => setCouponDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <select
                  value={couponRewardType}
                  onChange={(e) => setCouponRewardType(e.target.value as "discount" | "cashback")}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="discount">Discount (off order total)</option>
                  <option value="cashback">Cashback (credited to wallet)</option>
                </select>
                <select
                  value={couponValueType}
                  onChange={(e) => setCouponValueType(e.target.value as "flat" | "percent")}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="flat">Flat amount (Rs.)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  required
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                  placeholder="Value"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponMaxDiscount}
                  onChange={(e) => setCouponMaxDiscount(e.target.value)}
                  placeholder="Max discount (Rs., optional, for %)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponMinOrder}
                  onChange={(e) => setCouponMinOrder(e.target.value)}
                  placeholder="Minimum order amount (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponUsageLimit}
                  onChange={(e) => setCouponUsageLimit(e.target.value)}
                  placeholder="Total usage limit (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponPerUserLimit}
                  onChange={(e) => setCouponPerUserLimit(e.target.value)}
                  placeholder="Per-user limit (default 1)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
              {couponError && (
                <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{couponError}</p>
              )}
              <button
                type="submit"
                disabled={creatingCoupon}
                className="mt-4 rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {creatingCoupon ? "Creating..." : "Create coupon"}
              </button>
            </form>

            <div className="flex flex-col gap-2">
              {loadingCoupons && <p className="font-body text-sm text-rv-text-dim">Loading coupons...</p>}
              {!loadingCoupons && coupons.length === 0 && (
                <p className="font-body text-sm text-rv-text-dim">No coupons created yet.</p>
              )}
              {coupons.map((c) => (
                <div key={c.id} className="glass-panel flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-body text-sm text-rv-text">
                      {c.code} - {c.rewardType} - {c.valueType === "percent" ? `${c.value}%` : `Rs.${c.value}`}
                    </p>
                    <p className="font-body text-xs text-rv-text-dim">
                      Used {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} - {c.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleCoupon(c.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {c.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "users" && (
'@
$content = Apply-Edit $content $old6 $new6 "coupons tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
