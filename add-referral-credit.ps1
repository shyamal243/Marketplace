$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
# Normalize to \n for reliable matching, convert back to \r\n before writing
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
    const user = await db.orm.public.User.create({
      email,
      password: hashedPassword,
      name,
      role: role ?? "buyer",
      referralCode: myReferralCode,
      referredBy: referredByUserId,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
'@

$new = @'
    const user = await db.orm.public.User.create({
      email,
      password: hashedPassword,
      name,
      role: role ?? "buyer",
      referralCode: myReferralCode,
      referredBy: referredByUserId,
    });

    if (referredByUserId) {
      const rewardSetting = await db.orm.public.PlatformSetting.where({ key: "referral_reward_amount" }).first();
      const rewardAmount = rewardSetting ? Number(rewardSetting.value) : 20;

      if (rewardAmount > 0) {
        await db.transaction(async (tx) => {
          const referrer = await tx.orm.public.User.where({ id: referredByUserId! }).first();

          if (referrer) {
            await tx.orm.public.User.where({ id: referrer.id }).update({
              walletBalance: referrer.walletBalance + rewardAmount,
            });

            await tx.orm.public.WalletTransaction.create({
              amount: rewardAmount,
              type: "credit",
              reason: "referral_bonus",
              userId: referrer.id,
            });
          }

          await tx.orm.public.User.where({ id: user.id }).update({
            walletBalance: user.walletBalance + rewardAmount,
          });

          await tx.orm.public.WalletTransaction.create({
            amount: rewardAmount,
            type: "credit",
            reason: "referral_bonus",
            userId: user.id,
          });
        });
      }
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
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
    Write-Host "Fixed: referral bonus now credits both the referrer and the new user's wallet on signup." -ForegroundColor Green
} else {
    Write-Host "Anchor text still not found after line-ending normalization." -ForegroundColor Red
    Write-Host "Showing the actual bytes around 'const user = await db.orm.public.User.create' for comparison:" -ForegroundColor Yellow
    $idx = $content.IndexOf('const user = await db.orm.public.User.create')
    if ($idx -ge 0) {
        Write-Host $content.Substring($idx, [Math]::Min(700, $content.Length - $idx))
    } else {
        Write-Host "(could not even find that line at all)"
    }
}
