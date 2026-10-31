$path = "apps\web\app\stores\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

# ---- Edit 1: state ----
$old1 = @'
  const [coSupplierError, setCoSupplierError] = useState("");
'@

$new1 = @'
  const [coSupplierError, setCoSupplierError] = useState("");

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ createdCount: number; totalRows: number; errors: { row: number; error: string }[] } | null>(null);
  const [bulkError, setBulkError] = useState("");
'@

# ---- Edit 2: handlers ----
$old2 = @'
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  function updateCart(productId: number, quantity: number) {
'@

$new2 = @'
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleDownloadTemplate() {
    setBulkError("");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("http://localhost:4000/products/bulk-upload/template", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Could not download the template");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-upload-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    setBulkError("");
    setBulkResult(null);

    if (!bulkFile) {
      setBulkError("Please choose an Excel (.xlsx) file first");
      return;
    }

    setBulkUploading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const formData = new FormData();
      formData.append("storeId", String(id));
      formData.append("file", bulkFile);

      const response = await fetch("http://localhost:4000/products/bulk-upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setBulkResult(data);
      setBulkFile(null);
      await loadProducts();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBulkUploading(false);
    }
  }

  function updateCart(productId: number, quantity: number) {
'@

# ---- Edit 3: JSX ----
$old3 = @'
                {adding ? "Adding..." : "Add product"}
              </button>
            </div>
          </form>
        )}

        {isManager && (
          <form onSubmit={handleSavePrintSettings} className="glass-panel mt-6 p-6">
'@

$new3 = @'
                {adding ? "Adding..." : "Add product"}
              </button>
            </div>
          </form>
        )}

        {isManager && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Bulk upload products (Excel)</h2>
            <p className="mt-1 font-body text-xs text-rv-text-dim">
              Upload many products at once using a .xlsx file. Columns: name, description, category, price, stock.
            </p>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="mt-3 rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
            >
              Download sample template
            </button>

            <form onSubmit={handleBulkUpload} className="mt-4 flex flex-col gap-3">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setBulkFile(e.target.files ? e.target.files[0] : null)}
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <button
                type="submit"
                disabled={bulkUploading}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {bulkUploading ? "Uploading..." : "Upload products"}
              </button>
            </form>

            {bulkError && (
              <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{bulkError}</p>
            )}

            {bulkResult && (
              <div className="mt-3 rounded-md border border-rv-border bg-rv-panel px-4 py-3">
                <p className="font-body text-sm text-rv-cyan">
                  Created {bulkResult.createdCount} of {bulkResult.totalRows} products.
                </p>
                {bulkResult.errors.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {bulkResult.errors.map((err, i) => (
                      <li key={i} className="font-body text-xs text-rv-text-dim">
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {isManager && (
          <form onSubmit={handleSavePrintSettings} className="glass-panel mt-6 p-6">
'@

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

$content = Apply-Edit $content $old1 $new1 "state declarations"
$content = Apply-Edit $content $old2 $new2 "handler functions"
$content = Apply-Edit $content $old3 $new3 "JSX bulk-upload panel"

if ($hadCrLf) {
    $content = $content.Replace("`n", "`r`n")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing file. Check above for any FAILED lines." -ForegroundColor Cyan
