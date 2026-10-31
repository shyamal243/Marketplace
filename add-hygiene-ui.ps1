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
const [bulkError, setBulkError] = useState("");
'@
$new1 = @'
const [bulkError, setBulkError] = useState("");

  const [hygieneStatus, setHygieneStatus] = useState<{ uploadedToday: boolean; latestUploadedAt: string | null } | null>(null);
  const [hygieneFile, setHygieneFile] = useState<File | null>(null);
  const [uploadingHygiene, setUploadingHygiene] = useState(false);
  const [hygieneError, setHygieneError] = useState("");
'@
$content = Apply-Edit $content $old1 $new1 "hygiene state variables"

# 2. call loadHygieneStatus in the initial-load effect
$old2 = @'
useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
  }, [id]);
'@
$new2 = @'
useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
    loadHygieneStatus();
  }, [id]);
'@
$content = Apply-Edit $content $old2 $new2 "call loadHygieneStatus on load"

# 3. handler functions
$old3 = @'
async function handleDownloadTemplate() {
'@
$new3 = @'
async function loadHygieneStatus() {
    try {
      const response = await fetch(`http://localhost:4000/stores/${id}/hygiene-status`);
      const data = await response.json();
      if (response.ok) {
        setHygieneStatus(data);
      }
    } catch {
      // ignore - non-critical
    }
  }

  async function handleUploadHygienePhoto(e: React.FormEvent) {
    e.preventDefault();
    setHygieneError("");

    if (!hygieneFile) {
      setHygieneError("Please choose a photo first");
      return;
    }

    setUploadingHygiene(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const formData = new FormData();
      formData.append("photo", hygieneFile);

      const response = await fetch(`http://localhost:4000/stores/${id}/hygiene-photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setHygieneFile(null);
      await loadHygieneStatus();
    } catch (err) {
      setHygieneError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploadingHygiene(false);
    }
  }

  async function handleDownloadTemplate() {
'@
$content = Apply-Edit $content $old3 $new3 "hygiene handler functions"

# 4. JSX panel
$old4 = @'
        {isManager && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Bulk upload products (Excel)</h2>
'@
$new4 = @'
        {isManager && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Today's kitchen hygiene photo</h2>
            <p className="mt-1 font-body text-xs text-rv-text-dim">
              Required daily for stores selling food items before food orders can be placed.
            </p>
            <p className="mt-2 font-body text-sm">
              {hygieneStatus?.uploadedToday ? (
                <span className="text-rv-cyan">Verified today</span>
              ) : (
                <span className="text-rv-danger">Not uploaded today</span>
              )}
            </p>
            <form onSubmit={handleUploadHygienePhoto} className="mt-3 flex flex-col gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setHygieneFile(e.target.files ? e.target.files[0] : null)}
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <button
                type="submit"
                disabled={uploadingHygiene}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {uploadingHygiene ? "Uploading..." : "Upload today's photo"}
              </button>
            </form>
            {hygieneError && (
              <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{hygieneError}</p>
            )}
          </div>
        )}

        {isManager && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Bulk upload products (Excel)</h2>
'@
$content = Apply-Edit $content $old4 $new4 "hygiene photo upload JSX panel"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing stores/[id]/page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
