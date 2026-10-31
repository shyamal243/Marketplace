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

# 1. add interfaces after KycDoc interface
$old1 = @'
interface KycDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  userId: number;
}
'@
$new1 = @'
interface KycDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  userId: number;
}

interface StoreBenchmark {
  storeId: number;
  storeName: string;
  productCount: number;
  avgPrice: number;
  avgRating: number | null;
  unitsSold: number;
}

interface CategoryBenchmark {
  category: string;
  productCount: number;
  storeCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stores: StoreBenchmark[];
}
'@
$content = Apply-Edit $content $old1 $new1 "benchmark interfaces"

# 2. tab type union
$old2 = 'const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings">("users");'
$new2 = 'const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings" | "benchmarks">("users");'
$content = Apply-Edit $content $old2 $new2 "tab type union"

# 3. state for benchmarks
$old3 = @'
  const [referralReward, setReferralReward] = useState("");
'@
$new3 = @'
  const [referralReward, setReferralReward] = useState("");

  const [categories, setCategories] = useState<CategoryBenchmark[]>([]);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
'@
$content = Apply-Edit $content $old3 $new3 "benchmark state"

# 4. lazy-load effect on tab change
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
    if (tab === "benchmarks") {
      loadBenchmarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
'@
$content = Apply-Edit $content $old4 $new4 "benchmarks lazy-load effect"

# 5. loadBenchmarks function
$old5 = @'
  async function handleSetReferralReward(e: React.FormEvent) {
'@
$new5 = @'
  async function loadBenchmarks() {
    setLoadingBenchmarks(true);
    setBenchmarksError("");
    try {
      const data = await apiFetch("/co-admin/benchmarks");
      setCategories(data.categories);
    } catch (err) {
      setBenchmarksError(err instanceof Error ? err.message : "Failed to load benchmarks");
    } finally {
      setLoadingBenchmarks(false);
    }
  }

  async function handleSetReferralReward(e: React.FormEvent) {
'@
$content = Apply-Edit $content $old5 $new5 "loadBenchmarks function"

# 6. tab button array
$old6 = '{(["users", "orders", "kyc", "settings"] as const).map((t) => ('
$new6 = '{(["users", "orders", "kyc", "settings", "benchmarks"] as const).map((t) => ('
$content = Apply-Edit $content $old6 $new6 "tab button array"

# 7. JSX for benchmarks tab, inserted before settings tab
$old7 = @'
        {tab === "settings" && (
'@
$new7 = @'
        {tab === "benchmarks" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Benchmarks compare stores against each other within this marketplace, by category — there is no data
              from outside sellers or other platforms.
            </p>
            {benchmarksError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{benchmarksError}</p>
            )}
            {loadingBenchmarks && <p className="font-body text-sm text-rv-text-dim">Loading benchmarks...</p>}
            {!loadingBenchmarks && categories.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No active products to benchmark yet.</p>
            )}
            {categories.map((c) => (
              <div key={c.category} className="glass-panel px-5 py-4">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === c.category ? null : c.category)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-body text-sm capitalize text-rv-text">{c.category}</p>
                    <p className="font-body text-xs text-rv-text-dim">
                      {c.storeCount} store{c.storeCount === 1 ? "" : "s"} · {c.productCount} product{c.productCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-semibold text-rv-magenta">
                      ₹{c.minPrice} – ₹{c.maxPrice}
                    </p>
                    <p className="font-body text-xs text-rv-text-dim">avg ₹{c.avgPrice}</p>
                  </div>
                </button>

                {expandedCategory === c.category && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-rv-border pt-4">
                    {c.stores
                      .slice()
                      .sort((a, b) => b.unitsSold - a.unitsSold)
                      .map((s) => (
                        <div key={s.storeId} className="flex items-center justify-between rounded-md bg-rv-panel/50 px-4 py-2">
                          <div>
                            <p className="font-body text-sm text-rv-text">{s.storeName}</p>
                            <p className="font-body text-xs text-rv-text-dim">
                              {s.productCount} product{s.productCount === 1 ? "" : "s"} · avg ₹{s.avgPrice}
                              {s.avgRating !== null ? ` · ★ ${s.avgRating.toFixed(1)}` : " · no ratings yet"}
                            </p>
                          </div>
                          <span className="font-body text-xs text-rv-text-dim">{s.unitsSold} sold</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
'@
$content = Apply-Edit $content $old7 $new7 "benchmarks tab JSX"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing co-admin/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
