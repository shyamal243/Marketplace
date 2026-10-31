$path = "apps\web\app\co-admin\page.tsx"
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
$old1 = 'const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings" | "benchmarks">("users");'
$new1 = 'const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings" | "benchmarks" | "stores">("users");'
$content = Apply-Edit $content $old1 $new1 "tab type union"

# 2. state for stores
$old2 = @'
const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
'@
$new2 = @'
const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [myStores, setMyStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState("");
'@
$content = Apply-Edit $content $old2 $new2 "co-admin stores state"

# 3. lazy-load effect on tab change
$old3 = @'
  useEffect(() => {
    if (tab === "benchmarks") {
      loadBenchmarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$new3 = @'
  useEffect(() => {
    if (tab === "benchmarks") {
      loadBenchmarks();
    }
    if (tab === "stores") {
      loadMyStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old3 $new3 "stores lazy-load effect"

# 4. loadMyStores + toggle handlers
$old4 = @'
  async function handleSetReferralReward(e: React.FormEvent) {
'@
$new4 = @'
  async function loadMyStores() {
    setLoadingStores(true);
    setStoresError("");
    try {
      const data = await apiFetch("/co-admin/stores");
      setMyStores(data);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }

  async function handleToggleStoreActive(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/co-admin/stores/${storeId}/toggle-active`, { method: "POST" });
      await loadMyStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleTogglePrintService(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/co-admin/stores/${storeId}/toggle-print-service`, { method: "POST" });
      await loadMyStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSetReferralReward(e: React.FormEvent) {
'@
$content = Apply-Edit $content $old4 $new4 "loadMyStores + toggle handler functions"

# 5. tab button array
$old5 = '{(["users", "orders", "kyc", "settings", "benchmarks"] as const).map((t) => ('
$new5 = '{(["users", "orders", "kyc", "settings", "benchmarks", "stores"] as const).map((t) => ('
$content = Apply-Edit $content $old5 $new5 "tab button array"

# 6. JSX for stores tab, inserted before settings tab
$old6 = @'
        {tab === "settings" && (
'@
$new6 = @'
        {tab === "stores" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Only stores whose seller is in your city are shown here.
            </p>
            {storesError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{storesError}</p>
            )}
            {loadingStores && <p className="font-body text-sm text-rv-text-dim">Loading stores...</p>}
            {!loadingStores && myStores.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No stores found in your city.</p>
            )}
            {myStores.map((s) => (
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

        {tab === "settings" && (
'@
$content = Apply-Edit $content $old6 $new6 "stores tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing co-admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
