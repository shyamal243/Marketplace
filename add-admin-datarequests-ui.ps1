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
$old1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk">("users");'
$new1 = 'useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk" | "privacy">("users");'
$content = Apply-Edit $content $old1 $new1 "tab type union"

# 2. tab button array
$old2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk"] as const).map((t) => ('
$new2 = '{(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk", "privacy"] as const).map((t) => ('
$content = Apply-Edit $content $old2 $new2 "tab button array"

# 3. state
$old3 = @'
const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [loadingRiskFlags, setLoadingRiskFlags] = useState(false);
  const [riskError, setRiskError] = useState("");
'@
$new3 = @'
const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [loadingRiskFlags, setLoadingRiskFlags] = useState(false);
  const [riskError, setRiskError] = useState("");

  const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [loadingDataRequests, setLoadingDataRequests] = useState(false);
  const [dataRequestsError, setDataRequestsError] = useState("");
'@
$content = Apply-Edit $content $old3 $new3 "data request state"

# 4. extend lazy-load effect
$old4 = @'
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
$new4 = @'
  useEffect(() => {
    if (tab === "coupons") {
      loadCoupons();
    }
    if (tab === "risk") {
      loadRiskFlags();
    }
    if (tab === "privacy") {
      loadDataRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old4 $new4 "extend lazy-load effect for privacy tab"

# 5. handler functions
$old5 = @'
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
$new5 = @'
  async function handleResolveRiskFlag(flagId: number) {
    setRiskError("");
    try {
      await apiFetch(`/admin/risk-flags/${flagId}/resolve`, { method: "POST" });
      await loadRiskFlags();
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadDataRequests() {
    setLoadingDataRequests(true);
    setDataRequestsError("");
    try {
      const data = await apiFetch("/admin/data-requests");
      setDataRequests(data);
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Failed to load data requests");
    } finally {
      setLoadingDataRequests(false);
    }
  }

  async function handleCompleteDataRequest(requestId: number) {
    setDataRequestsError("");
    try {
      await apiFetch(`/admin/data-requests/${requestId}/complete`, { method: "POST" });
      await loadDataRequests();
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

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
$content = Apply-Edit $content $old5 $new5 "data request handler functions"

# 6. JSX tab content
$old6 = @'
        {tab === "coupons" && (
'@
$new6 = @'
        {tab === "privacy" && (
          <div className="mt-6 flex flex-col gap-2">
            {dataRequestsError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{dataRequestsError}</p>
            )}
            {loadingDataRequests && <p className="font-body text-sm text-rv-text-dim">Loading data requests...</p>}
            {!loadingDataRequests && dataRequests.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No data requests yet.</p>
            )}
            {dataRequests.map((r) => (
              <div key={r.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">
                    User #{r.userId} - {r.type}
                    {r.notes ? ` - "${r.notes}"` : ""}
                  </p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Requested {new Date(r.requestedAt).toLocaleString()}
                    {" - "}
                    <span
                      className={
                        r.status === "completed"
                          ? "text-rv-cyan"
                          : r.status === "rejected"
                          ? "text-rv-danger"
                          : "text-rv-text-dim"
                      }
                    >
                      {r.status}
                    </span>
                  </p>
                </div>
                {r.type === "deletion" && r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCompleteDataRequest(r.id)}
                      className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                    >
                      Approve &amp; anonymize
                    </button>
                    <button
                      onClick={() => handleRejectDataRequest(r.id)}
                      className="rounded-md border border-rv-danger/50 px-3 py-1.5 font-body text-sm text-rv-danger transition hover:bg-rv-danger/10"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "coupons" && (
'@
$content = Apply-Edit $content $old6 $new6 "privacy tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
