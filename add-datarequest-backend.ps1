$path = "apps\api\src\index.ts"
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

# 1. Admin data-request routes, inserted after the risk-flag resolve route
$old1 = @'
app.post("/admin/risk-flags/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const flagId = Number(req.params.id);
    const flag = await db.orm.public.RiskFlag.where({ id: flagId }).first();

    if (!flag) {
      return res.status(404).json({ error: "Risk flag not found" });
    }

    const updated = await db.orm.public.RiskFlag.where({ id: flagId }).update({ resolved: !flag.resolved });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
'@
$new1 = @'
app.post("/admin/risk-flags/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const flagId = Number(req.params.id);
    const flag = await db.orm.public.RiskFlag.where({ id: flagId }).first();

    if (!flag) {
      return res.status(404).json({ error: "Risk flag not found" });
    }

    const updated = await db.orm.public.RiskFlag.where({ id: flagId }).update({ resolved: !flag.resolved });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/data-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requests = await db.orm.public.DataRequest.where({}).all();
    requests.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/data-requests/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requestId = Number(req.params.id);
    const dataRequest = await db.orm.public.DataRequest.where({ id: requestId }).first();

    if (!dataRequest) {
      return res.status(404).json({ error: "Data request not found" });
    }

    if (dataRequest.type !== "deletion") {
      return res.status(400).json({ error: "Only deletion requests can be completed this way" });
    }

    if (dataRequest.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    const targetUser = await db.orm.public.User.where({ id: dataRequest.userId }).first();

    if (targetUser) {
      const scrambledPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);

      await db.orm.public.User.where({ id: targetUser.id }).update({
        email: `deleted-user-${targetUser.id}@deleted.local`,
        name: "Deleted User",
        phone: null,
        address: null,
        city: null,
        password: scrambledPassword,
      });
    }

    const updated = await db.orm.public.DataRequest.where({ id: requestId }).update({
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/data-requests/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requestId = Number(req.params.id);
    const dataRequest = await db.orm.public.DataRequest.where({ id: requestId }).first();

    if (!dataRequest) {
      return res.status(404).json({ error: "Data request not found" });
    }

    if (dataRequest.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    const updated = await db.orm.public.DataRequest.where({ id: requestId }).update({ status: "rejected" });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
'@
$content = Apply-Edit $content $old1 $new1 "admin data-request routes"

# 2. Buyer-facing data-request routes, inserted before app.listen
$old2 = @'
app.get("/referral/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();
    res.status(200).json({ referralCode: user?.referralCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
'@
$new2 = @'
app.get("/referral/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();
    res.status(200).json({ referralCode: user?.referralCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/data-requests/export", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const safeProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      city: user.city,
      role: user.role,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    };

    const ordersAsBuyer = await db.orm.public.Order.where({ buyerId: user.id }).all();
    const ordersAsSeller = await db.orm.public.Order.where({ sellerId: user.id }).all();
    const reviewsGiven = await db.orm.public.Review.where({ reviewerId: user.id }).all();
    const reviewsReceived = await db.orm.public.Review.where({ revieweeId: user.id }).all();
    const walletTransactions = await db.orm.public.WalletTransaction.where({ userId: user.id }).all();
    const stores = await db.orm.public.Store.where({ sellerId: user.id }).all();

    await db.orm.public.DataRequest.create({
      userId: user.id,
      type: "export",
      status: "completed",
      notes: "Self-service data export",
      completedAt: new Date().toISOString(),
    });

    res.status(200).json({
      profile: safeProfile,
      ordersAsBuyer,
      ordersAsSeller,
      reviewsGiven,
      reviewsReceived,
      walletTransactions,
      stores,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/data-requests/deletion", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;

    const created = await db.orm.public.DataRequest.create({
      userId: req.userId!,
      type: "deletion",
      status: "pending",
      notes: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      completedAt: null,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/data-requests/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requests = await db.orm.public.DataRequest.where({ userId: req.userId! }).all();
    requests.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
'@
$content = Apply-Edit $content $old2 $new2 "buyer data-request routes"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
