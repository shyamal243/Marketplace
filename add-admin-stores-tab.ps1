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
$old1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk" | "privacy">("users");'
$new1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk" | "privacy" | "stores">("users");'
$content = Apply-Edit $content $old1 $new1 "tab type union"

# 2. tab button array
$old2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk", "privacy"] as const).map((t) => ('
$new2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk", "privacy", "stores"] as const).map((t) => ('
$content = Apply-Edit $content $old2 $new2 "tab button array"

# 3. state
$old3 = @'
const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [loadingDataRequests, setLoadingDataRequests] = useState(false);
  const [dataRequestsError, setDataRequestsError] = useState("");
'@
$new3 = @'
const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [loadingDataRequests, setLoadingDataRequests] = useState(false);
  const [dataRequestsError, setDataRequestsError] = useState("");

  const [stores, setStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState("");
'@
$content = Apply-Edit $content $old3 $new3 "stores state"

# 4. extend lazy-load effect
$old4 = @'
    if (tab === "privacy") {
      loadDataRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$new4 = @'
    if (tab === "privacy") {
      loadDataRequests();
    }
    if (tab === "stores") {
      loadStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old4 $new4 "extend lazy-load effect for stores tab"

# 5. handler functions
$old5 = @'
  async function handleRejectDataRequest(requestId: number) {
    setDataRequestsError("");
    try {
      await apiFetch(`/admin/data-requests/${requestId}/reject`, { method: "POST" });
      await loadDataRequests();
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
'@
$new5 = @'
  async function handleRejectDataRequest(requestId: number) {
    setDataRequestsError("");
    try {
      await apiFetch(`/admin/data-requests/${requestId}/reject`, { method: "POST" });
      await loadDataRequests();
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadStores() {
    setLoadingStores(true);
    setStoresError("");
    try {
      const data = await apiFetch("/admin/stores");
      setStores(data);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }

  async function handleToggleStoreActive(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/admin/stores/${storeId}/toggle-active`, { method: "POST" });
      await loadStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleTogglePrintService(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/admin/stores/${storeId}/toggle-print-service`, { method: "POST" });
      await loadStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
'@
$content = Apply-Edit $content $old5 $new5 "stores handler functions"

# 6. JSX tab content
$old6 = @'
        {tab === "coupons" && (
'@
$new6 = @'
        {tab === "stores" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Toggle a store off to hide it from buyers entirely, or toggle off just its print service while keeping
              the store open.
            </p>
            {storesError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{storesError}</p>
            )}
            {loadingStores && <p className="font-body text-sm text-rv-text-dim">Loading stores...</p>}
            {!loadingStores && stores.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No stores found.</p>
            )}
            {stores.map((s) => (
              <div key={s.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">{s.name}</p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Seller: {s.sellerName} ·{" "}
                    <span className={s.isActive ? "text-rv-cyan" : "text-rv-danger"}>{s.isActive ? "Active" : "Deactivated"}</span>
                    {" · Print service: "}
                    <span className={s.offersPrintService ? "text-rv-cyan" : "text-rv-text-dim"}>
                      {s.offersPrintService ? "On" : "Off"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStoreActive(s.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {s.isActive ? "Deactivate store" : "Activate store"}
                  </button>
                  <button
                    onClick={() => handleTogglePrintService(s.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {s.offersPrintService ? "Turn off print service" : "Turn on print service"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "coupons" && (
'@
$content = Apply-Edit $content $old6 $new6 "stores tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
