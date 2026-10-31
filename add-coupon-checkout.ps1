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

# ---- Edit 1: coupon validation, after the items loop ----
$old1 = @'
      subtotal += product.price * quantity;
      validatedItems.push({ productId, quantity, priceAtPurchase: product.price });
      if (product.category === "jewellery") hasJewellery = true;
    }

    let deliveryFeeAmount = store.deliveryFeeBase;
'@

$new1 = @'
      subtotal += product.price * quantity;
      validatedItems.push({ productId, quantity, priceAtPurchase: product.price });
      if (product.category === "jewellery") hasJewellery = true;
    }

    const { couponCode } = req.body;
    let appliedCoupon: { id: number; code: string; rewardType: string; discountAmount: number } | null = null;

    if (couponCode) {
      const coupon = await db.orm.public.Coupon.where({ code: String(couponCode).trim().toUpperCase() }).first();

      if (!coupon || !coupon.isActive) {
        return res.status(400).json({ error: "Invalid or inactive coupon code" });
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This coupon has expired" });
      }

      if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
        return res.status(400).json({ error: `This coupon requires a minimum order of Rs.${coupon.minOrderAmount}` });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: "This coupon has reached its usage limit" });
      }

      if (coupon.perUserLimit) {
        const previousUses = await db.orm.public.CouponRedemption.where({ couponId: coupon.id, userId: req.userId! }).all();
        if (previousUses.length >= coupon.perUserLimit) {
          return res.status(400).json({ error: "You have already used this coupon the maximum number of times" });
        }
      }

      let rawAmount = coupon.valueType === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

      if (coupon.maxDiscount && rawAmount > coupon.maxDiscount) {
        rawAmount = coupon.maxDiscount;
      }

      if (rawAmount > subtotal) {
        rawAmount = subtotal;
      }

      appliedCoupon = { id: coupon.id, code: coupon.code, rewardType: coupon.rewardType, discountAmount: rawAmount };
    }

    let deliveryFeeAmount = store.deliveryFeeBase;
'@

$content = Apply-Edit $content $old1 $new1 "coupon validation block"

# ---- Edit 2: apply discount to totalAmount ----
$old2 = @'
    const totalAmount = subtotal + deliveryFeeAmount;
'@

$new2 = @'
    const discountAmount = appliedCoupon && appliedCoupon.rewardType === "discount" ? appliedCoupon.discountAmount : 0;
    const totalAmount = subtotal + deliveryFeeAmount - discountAmount;
'@

$content = Apply-Edit $content $old2 $new2 "discount applied to totalAmount"

# ---- Edit 3: record redemption + cashback inside the transaction ----
$old3 = @'
            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      for (const item of validatedItems) {
'@

$new3 = @'
            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      if (appliedCoupon) {
        await tx.orm.public.CouponRedemption.create({
          couponId: appliedCoupon.id,
          userId: req.userId!,
          orderId: newOrder.id,
          amount: appliedCoupon.discountAmount,
        });

        const currentCoupon = await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).first();

        if (currentCoupon) {
          await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).update({
            usedCount: currentCoupon.usedCount + 1,
          });
        }

        if (appliedCoupon.rewardType === "cashback" && appliedCoupon.discountAmount > 0) {
          const buyer = await tx.orm.public.User.where({ id: req.userId! }).first();
          if (buyer) {
            await tx.orm.public.User.where({ id: buyer.id }).update({
              walletBalance: buyer.walletBalance + appliedCoupon.discountAmount,
            });

            await tx.orm.public.WalletTransaction.create({
              amount: appliedCoupon.discountAmount,
              type: "credit",
              reason: "cashback",
              userId: buyer.id,
            });
          }
        }
      }

      for (const item of validatedItems) {
'@

$content = Apply-Edit $content $old3 $new3 "record redemption + cashback"

# ---- Edit 4: include coupon info in response ----
$old4 = @'
    res.status(201).json({ ...order, items: validatedItems, subtotal, deliveryFeeAmount, totalAmount, devCheckoutOtp: hasJewellery ? checkoutOtp : undefined });
'@

$new4 = @'
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

$content = Apply-Edit $content $old4 $new4 "response includes coupon info"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing index.ts. Check above for any FAILED lines." -ForegroundColor Cyan
