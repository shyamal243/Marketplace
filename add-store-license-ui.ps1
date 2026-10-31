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

# 1. Store interface, added after CoSupplier interface
$old1 = @'
interface CoSupplier {
  accessId: number;
  userId: number;
  name: string;
  email: string;
}
'@
$new1 = @'
interface CoSupplier {
  accessId: number;
  userId: number;
  name: string;
  email: string;
}

interface StoreInfo {
  id: number;
  name: string;
  address: string | null;
  isActive: boolean;
  offersPrintService: boolean;
  fssaiLicenseNumber: string | null;
  businessRegistrationNumber: string | null;
}
'@
$content = Apply-Edit $content $old1 $new1 "StoreInfo interface"

# 2. state
$old2 = @'
  const [hygieneStatus, setHygieneStatus] = useState<{ uploadedToday: boolean; latestUploadedAt: string | null } | null>(null);
  const [hygieneFile, setHygieneFile] = useState<File | null>(null);
  const [uploadingHygiene, setUploadingHygiene] = useState(false);
  const [hygieneError, setHygieneError] = useState("");
'@
$new2 = @'
  const [hygieneStatus, setHygieneStatus] = useState<{ uploadedToday: boolean; latestUploadedAt: string | null } | null>(null);
  const [hygieneFile, setHygieneFile] = useState<File | null>(null);
  const [uploadingHygiene, setUploadingHygiene] = useState(false);
  const [hygieneError, setHygieneError] = useState("");

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [fssaiInput, setFssaiInput] = useState("");
  const [businessRegInput, setBusinessRegInput] = useState("");
  const [savingLicenseInfo, setSavingLicenseInfo] = useState(false);
  const [licenseError, setLicenseError] = useState("");
  const [licenseMessage, setLicenseMessage] = useState("");
'@
$content = Apply-Edit $content $old2 $new2 "store license state"

# 3. extend initial effect + add loadStoreInfo/handleSaveLicenseInfo functions
$old3 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
    loadHygieneStatus();
  }, [id]);

  useEffect(() => {
    if (user?.role === "seller") {
      loadCoSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
'@
$new3 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
    loadHygieneStatus();
    loadStoreInfo();
  }, [id]);

  useEffect(() => {
    if (user?.role === "seller") {
      loadCoSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadStoreInfo() {
    try {
      const data = await apiFetch(`/stores/${id}`);
      setStore(data);
      setFssaiInput(data.fssaiLicenseNumber || "");
      setBusinessRegInput(data.businessRegistrationNumber || "");
    } catch {
      // not critical - the page still works without store metadata
    }
  }

  async function handleSaveLicenseInfo(e: React.FormEvent) {
    e.preventDefault();
    setLicenseError("");
    setLicenseMessage("");
    setSavingLicenseInfo(true);
    try {
      await apiFetch(`/stores/${id}/license-info`, {
        method: "POST",
        body: JSON.stringify({
          fssaiLicenseNumber: fssaiInput || undefined,
          businessRegistrationNumber: businessRegInput || undefined,
        }),
      });
      setLicenseMessage("License info saved.");
      await loadStoreInfo();
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingLicenseInfo(false);
    }
  }
'@
$content = Apply-Edit $content $old3 $new3 "loadStoreInfo + handleSaveLicenseInfo"

# 4. header: show real store name + license badges to everyone
$old4 = @'
<h1 className="font-display text-3xl font-semibold text-rv-text">Store #{id}</h1>
          <div className="flex items-center gap-2">
'@
$new4 = @'
<div>
            <h1 className="font-display text-3xl font-semibold text-rv-text">{store?.name || `Store #${id}`}</h1>
            {store && (store.fssaiLicenseNumber || store.businessRegistrationNumber) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {store.fssaiLicenseNumber && (
                  <span className="rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                    FSSAI: {store.fssaiLicenseNumber}
                  </span>
                )}
                {store.businessRegistrationNumber && (
                  <span className="rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                    Reg. No: {store.businessRegistrationNumber}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
'@
$content = Apply-Edit $content $old4 $new4 "store name + license badges in header"

# 5. license edit form for managers, after the print-settings form
$old5 = @'
            <button
              type="submit"
              disabled={savingPrintSettings}
              className="mt-4 rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {savingPrintSettings ? "Saving..." : "Save print settings"}
            </button>
          </form>
'@
$new5 = @'
            <button
              type="submit"
              disabled={savingPrintSettings}
              className="mt-4 rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {savingPrintSettings ? "Saving..." : "Save print settings"}
            </button>
          </form>
        )}

        {isManager && (
          <form onSubmit={handleSaveLicenseInfo} className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">License &amp; registration info</h2>
            <p className="mt-1 font-body text-xs text-rv-text-dim">
              Shown to buyers on this page to build trust. Leave blank if not applicable.
            </p>
            {licenseError && (
              <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{licenseError}</p>
            )}
            {licenseMessage && (
              <p className="mt-3 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-2 font-body text-sm text-rv-cyan">{licenseMessage}</p>
            )}
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className="font-body text-xs font-medium text-rv-text-dim">FSSAI license number</label>
                <input
                  type="text"
                  value={fssaiInput}
                  onChange={(e) => setFssaiInput(e.target.value)}
                  placeholder="e.g. 12345678901234"
                  className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
              <div>
                <label className="font-body text-xs font-medium text-rv-text-dim">Business registration number</label>
                <input
                  type="text"
                  value={businessRegInput}
                  onChange={(e) => setBusinessRegInput(e.target.value)}
                  placeholder="e.g. GST / Udyam / CIN number"
                  className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingLicenseInfo}
              className="mt-4 rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {savingLicenseInfo ? "Saving..." : "Save license info"}
            </button>
          </form>
'@
$content = Apply-Edit $content $old5 $new5 "license info edit form"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing stores/[id]/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
