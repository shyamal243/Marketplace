$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
    const setting = await db.orm.public.PlatformSetting.create({ key: "referral_reward_amount", value: String(amount) });
    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
'@

$new = @'
    const setting = await db.orm.public.PlatformSetting.create({ key: "referral_reward_amount", value: String(amount) });
    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { code, description, rewardType, valueType, value, maxDiscount, minOrderAmount, usageLimit, perUserLimit, expiresAt } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required" });
    }

    if (rewardType !== "discount" && rewardType !== "cashback") {
      return res.status(400).json({ error: "rewardType must be \"discount\" or \"cashback\"" });
    }

    if (valueType !== "flat" && valueType !== "percent") {
      return res.status(400).json({ error: "valueType must be \"flat\" or \"percent\"" });
    }

    if (typeof value !== "number" || value <= 0) {
      return res.status(400).json({ error: "value must be a positive number" });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existing = await db.orm.public.Coupon.where({ code: normalizedCode }).first();

    if (existing) {
      return res.status(400).json({ error: "A coupon with this code already exists" });
    }

    const coupon = await db.orm.public.Coupon.create({
      code: normalizedCode,
      description: description || null,
      rewardType,
      valueType,
      value,
      maxDiscount: maxDiscount ?? null,
      minOrderAmount: minOrderAmount ?? null,
      usageLimit: usageLimit ?? null,
      perUserLimit: perUserLimit ?? 1,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const coupons = await db.orm.public.Coupon.where({}).all();
    res.status(200).json(coupons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/coupons/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const couponId = Number(req.params.id);
    const coupon = await db.orm.public.Coupon.where({ id: couponId }).first();

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const updated = await db.orm.public.Coupon.where({ id: couponId }).update({ isActive: !coupon.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
'@

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $updated = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $updated = $updated.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $updated, $utf8NoBom)
    Write-Host "Added: POST /admin/coupons, GET /admin/coupons, POST /admin/coupons/:id/toggle" -ForegroundColor Green
} else {
    Write-Host "Anchor not found. Showing current text around 'referral_reward_amount' create call:" -ForegroundColor Red
    $idx = $content.IndexOf('const setting = await db.orm.public.PlatformSetting.create')
    if ($idx -ge 0) {
        Write-Host $content.Substring($idx, [Math]::Min(600, $content.Length - $idx))
    }
}
