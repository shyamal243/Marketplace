$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
    const product = await db.orm.public.Product.create({
      name,
      description,
      category: category || undefined,
      price,
      stock: stock ?? 0,
      storeId,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
'@

$new = @'
    const product = await db.orm.public.Product.create({
      name,
      description,
      category: category || undefined,
      price,
      stock: stock ?? 0,
      storeId,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products/bulk-upload/template", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can access this" });
    }

    const XLSX = require("xlsx");

    const headers = ["name", "description", "category", "price", "stock"];
    const sampleRow = ["Sample Product", "A short description of the product", "fmcg", 199.5, 25];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=product-upload-template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products/bulk-upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can bulk upload products" });
    }

    const { storeId } = req.body;
    const uploadedFile = req.file;

    if (!storeId) {
      if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({ error: "storeId is required" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "Please attach an Excel (.xlsx) file" });
    }

    const store = await db.orm.public.Store.where({ id: Number(storeId) }).first();

    if (!store) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(uploadedFile.path);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    fs.unlink(uploadedFile.path, () => {});

    if (rows.length === 0) {
      return res.status(400).json({ error: "The uploaded file has no product rows" });
    }

    const created: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const name = row.name ? String(row.name).trim() : "";
      const description = row.description ? String(row.description).trim() : undefined;
      const category = row.category ? String(row.category).trim() : undefined;
      const price = Number(row.price);
      const stock = row.stock !== null && row.stock !== undefined ? Number(row.stock) : 0;

      if (!name) {
        errors.push({ row: rowNumber, error: "name is required" });
        continue;
      }

      if (!price || price <= 0 || Number.isNaN(price)) {
        errors.push({ row: rowNumber, error: "price must be a positive number" });
        continue;
      }

      if (Number.isNaN(stock) || stock < 0) {
        errors.push({ row: rowNumber, error: "stock must be a non-negative number" });
        continue;
      }

      try {
        const product = await db.orm.public.Product.create({
          name,
          description,
          category,
          price,
          stock,
          storeId: store.id,
        });
        created.push(product);
      } catch (err) {
        errors.push({ row: rowNumber, error: "Failed to create product" });
      }
    }

    res.status(200).json({
      createdCount: created.length,
      totalRows: rows.length,
      errors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
'@

$oldNormalized = $old.Replace("`r`n", "`n")
$newNormalized = $new.Replace("`r`n", "`n")

if ($content.Contains($oldNormalized)) {
    $updated = $content.Replace($oldNormalized, $newNormalized)
    if ($hadCrLf) {
        $updated = $updated.Replace("`n", "`r`n")
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $updated, $utf8NoBom)
    Write-Host "Added: GET /products/bulk-upload/template and POST /products/bulk-upload" -ForegroundColor Green
} else {
    Write-Host "Anchor text not found. Showing current text around 'res.status(201).json(product)' for comparison:" -ForegroundColor Red
    $idx = $content.IndexOf('res.status(201).json(product)')
    if ($idx -ge 0) {
        Write-Host $content.Substring([Math]::Max(0, $idx - 300), [Math]::Min(700, $content.Length - $idx))
    }
}
