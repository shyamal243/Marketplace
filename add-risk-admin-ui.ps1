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
$old1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons">("users");'
$new1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk">("users");'
$content = Apply-Edit $content $old1 $new1 "tab type union"

# 2. tab button array
$old2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons"] as const).map((t) => ('
$new2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk"] as const).map((t) => ('
$content = Apply-Edit $content $old2 $new2 "tab button array"

# 3. state
$old3 = @'
  const [creatingCoupon, setCreatingCoupon] = useState(false);
'@
$new3 = @'
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [loadingRiskFlags, setLoadingRiskFlags] = useState(false);
  const [riskError, setRiskError] = useState("");
'@
$content = Apply-Edit $content $old3 $new3 "risk flag state"

# 4. extend lazy-load effect
$old4 = @'
useEffect(() => {
    if (tab === "coupons") {
      loadCoupons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$new4 = @'
useEffect(() => {
    if (tab === "coupons") {
      loadCoupons();
    }
    if (tab === "risk") {
      loadRiskFlags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old4 $new4 "extend lazy-load effect for risk tab"

# 5. handler functions
$old5 = @'
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
$new5 = @'
  async function handleToggleCoupon(couponId: number) {
    setCouponError("");
    try {
      await apiFetch(`/admin/coupons/${couponId}/toggle`, { method: "POST" });
      await loadCoupons();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadRiskFlags() {
    setLoadingRiskFlags(true);
    setRiskError("");
    try {
      const data = await apiFetch("/admin/risk-flags");
      setRiskFlags(data);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Failed to load risk flags");
    } finally {
      setLoadingRiskFlags(false);
    }
  }

  async function handleResolveRiskFlag(flagId: number) {
    setRiskError("");
    try {
      await apiFetch(`/admin/risk-flags/${flagId}/resolve`, { method: "POST" });
      await loadRiskFlags();
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
'@
$content = Apply-Edit $content $old5 $new5 "risk flag handler functions"

# 6. JSX tab content
$old6 = @'
        {tab === "coupons" && (
'@
$new6 = @'
        {tab === "risk" && (
          <div className="mt-6 flex flex-col gap-2">
            {riskError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{riskError}</p>
            )}
            {loadingRiskFlags && <p className="font-body text-sm text-rv-text-dim">Loading risk flags...</p>}
            {!loadingRiskFlags && riskFlags.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No risk flags. Nothing suspicious detected yet.</p>
            )}
            {riskFlags.map((f) => (
              <div key={f.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">
                    {f.entityType} #{f.entityId} - {f.reason}
                  </p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Severity: <span className={f.severity === "high" ? "text-rv-danger" : "text-rv-cyan"}>{f.severity}</span>
                    {" - "}
                    {f.resolved ? "Resolved" : "Open"}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveRiskFlag(f.id)}
                  className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                >
                  {f.resolved ? "Reopen" : "Mark resolved"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "coupons" && (
'@
$content = Apply-Edit $content $old6 $new6 "risk tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
