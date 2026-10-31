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

# 1. risk evaluation in checkout, before the response
$old1 = @'
    await db.orm.public.Notification.create({
      message: `New order #${order.id} received at your store "${store.name}"`,
      type: "new_store_order",
      userId: store.sellerId,
    });

    res.status(201).json({
      ...order,
      items: validatedItems,
      subtotal,
      deliveryFeeAmount,
      discountAmount,
      totalAmount,
      couponApplied: appliedCoupon
        ? { code: appliedCoupon.code, rewardType: appliedCoupon.rewardType, amount: appliedCoupon.discountAmount }
        : null,
      devCheckoutOtp: hasJewellery ? checkoutOtp : undefined,
    });
'@
$new1 = @'
    await db.orm.public.Notification.create({
      message: `New order #${order.id} received at your store "${store.name}"`,
      type: "new_store_order",
      userId: store.sellerId,
    });

    try {
      const buyerForRisk = await db.orm.public.User.where({ id: req.userId! }).first();

      if (buyerForRisk) {
        const accountAgeMs = Date.now() - new Date(buyerForRisk.createdAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (accountAgeMs < oneDayMs && totalAmount > 5000) {
          await db.orm.public.RiskFlag.create({
            entityType: "order",
            entityId: order.id,
            reason: "High-value order from a newly created account",
            severity: "high",
          });
        }

        const pastOrders = await db.orm.public.Order.where({ buyerId: buyerForRisk.id, orderType: "store_order" }).all();
        const previousOrders = pastOrders.filter((o: any) => o.id !== order.id);

        if (previousOrders.length >= 3) {
          const avgAmount = previousOrders.reduce((sum: number, o: any) => sum + o.amount, 0) / previousOrders.length;
          if (avgAmount > 0 && totalAmount > avgAmount * 5) {
            await db.orm.public.RiskFlag.create({
              entityType: "order",
              entityId: order.id,
              reason: "Order amount far exceeds this buyer's usual order size",
              severity: "medium",
            });
          }
        }
      }
    } catch (riskError) {
      console.error("Risk evaluation failed (non-blocking):", riskError);
    }

    res.status(201).json({
      ...order,
      items: validatedItems,
      subtotal,
      deliveryFeeAmount,
      discountAmount,
      totalAmount,
      couponApplied: appliedCoupon
        ? { code: appliedCoupon.code, rewardType: appliedCoupon.rewardType, amount: appliedCoupon.discountAmount }
        : null,
      devCheckoutOtp: hasJewellery ? checkoutOtp : undefined,
    });
'@
$content = Apply-Edit $content $old1 $new1 "risk evaluation in checkout"

# 2. admin routes
$old2 = @'
    const updated = await db.orm.public.Coupon.where({ id: couponId }).update({ isActive: !coupon.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
'@
$new2 = @'
    const updated = await db.orm.public.Coupon.where({ id: couponId }).update({ isActive: !coupon.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/risk-flags", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const flags = await db.orm.public.RiskFlag.where({}).all();
    flags.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json(flags);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

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
$content = Apply-Edit $content $old2 $new2 "admin risk-flag routes"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
