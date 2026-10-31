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

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# -------------------------------------------------------------------
# 1. Write the new shared Header component
# -------------------------------------------------------------------
$headerPath = "apps\web\app\Header.tsx"
if (-not (Test-Path "apps\web\app")) {
    Write-Host "Could not find apps\web\app - run this from the repo root." -ForegroundColor Red
    exit 1
}

$headerContent = @'
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "./lib/api";

interface HeaderUser {
  id: number;
  name: string;
  role: string;
}

const SERVICE_LINKS: { key: string; label: string; href: string }[] = [
  { key: "postdemand", label: "Post a Demand", href: "/?tab=postdemand" },
  { key: "ecommerce", label: "E/Q-Commerce", href: "/?tab=ecommerce" },
  { key: "professionals", label: "Professionals", href: "/?tab=professionals" },
  { key: "logistics", label: "Logistics", href: "/?tab=logistics" },
];

export default function Header() {
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch {
      // even if this fails, still clear local session
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <header className="relative flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
      <Link href="/" className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
        DEMAND//BOARD
      </Link>

      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
        <div className="relative" ref={servicesRef}>
          <button
            type="button"
            onClick={() => setServicesOpen((v) => !v)}
            className="flex items-center gap-1 font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
          >
            Services
            <span className="text-[10px]">▾</span>
          </button>
          {servicesOpen && (
            <div className="absolute left-0 top-8 z-20 flex w-52 flex-col rounded-lg border border-rv-border bg-rv-bg-alt p-2 shadow-hud-glow">
              {SERVICE_LINKS.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  onClick={() => setServicesOpen(false)}
                  className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel hover:text-rv-cyan"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/about" className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan">
          About us
        </Link>

        <Link href="/support" className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan">
          Help
        </Link>

        {user ? (
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-rv-cyan px-3.5 py-1.5 font-body text-sm text-rv-cyan"
            >
              My account
              <span className="text-[10px]">▾</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-10 z-20 flex w-56 flex-col rounded-lg border border-rv-border bg-rv-bg-alt p-2 shadow-hud-glow">
                <span className="border-b border-rv-border px-3 py-2 font-body text-sm text-rv-text">
                  {user.name} · {user.role}
                </span>
                {user.role === "admin" && (
                  <Link href="/admin" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-magenta transition hover:bg-rv-panel">
                    Admin
                  </Link>
                )}
                {user.role === "co_admin" && (
                  <Link href="/co-admin" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-cyan transition hover:bg-rv-panel">
                    Co-Admin
                  </Link>
                )}
                {user.role === "co_supplier" && (
                  <Link href="/co-supplier" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-cyan transition hover:bg-rv-panel">
                    Stores I manage
                  </Link>
                )}
                {user.role === "employee" && (
                  <Link href="/employee" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-cyan transition hover:bg-rv-panel">
                    My tasks
                  </Link>
                )}
                <Link href="/profile" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  Profile
                </Link>
                <Link href="/notifications" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  Notifications
                </Link>
                <Link href="/wallet" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  Wallet
                </Link>
                <Link href="/orders" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  My orders
                </Link>
                <Link href="/favorites" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  Favorites
                </Link>
                <Link href="/reviews" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                  Reviews
                </Link>
                {user.role === "seller" && (
                  <Link href="/returns" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                    Returns
                  </Link>
                )}
                {(user.role === "seller" || user.role === "delivery") && (
                  <Link href="/kyc" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                    Verification
                  </Link>
                )}
                {user.role === "seller" && (
                  <Link href="/store/new" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                    Open a store
                  </Link>
                )}
                {user.role === "professional" && (
                  <Link href="/professional/skills" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                    My skills
                  </Link>
                )}
                {user.role === "delivery" && (
                  <Link href="/deliveries" onClick={() => setAccountOpen(false)} className="rounded-md px-3 py-2 font-body text-sm text-rv-text transition hover:bg-rv-panel">
                    Deliveries
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 rounded-md border-t border-rv-border px-3 py-2 text-left font-body text-sm text-rv-magenta transition hover:bg-rv-panel"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-rv-magenta px-4 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
'@

[System.IO.File]::WriteAllText((Join-Path (Get-Location) $headerPath), $headerContent, $utf8NoBom)
Write-Host "Wrote $headerPath" -ForegroundColor Green

# -------------------------------------------------------------------
# 2. Rewrite Footer.tsx: keep only Help & FAQ / Terms / Privacy
# -------------------------------------------------------------------
$footerPath = "apps\web\app\Footer.tsx"
$footerContent = @'
"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-rv-border px-8 py-6 md:px-16 glass-panel rounded-none">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
        <p className="font-body text-xs text-rv-text-dim">
          © {new Date().getFullYear()} Demand Board. All rights reserved.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/support" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            Help &amp; FAQ
          </Link>
          <Link href="/legal/terms" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            Terms
          </Link>
          <Link href="/legal/privacy" className="font-body text-xs text-rv-text-dim transition hover:text-rv-cyan">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
'@

[System.IO.File]::WriteAllText((Join-Path (Get-Location) $footerPath), $footerContent, $utf8NoBom)
Write-Host "Wrote $footerPath" -ForegroundColor Green

# -------------------------------------------------------------------
# 3. Patch apps\web\app\page.tsx: use <Header />, sync ?tab= on load
# -------------------------------------------------------------------
$pagePath = "apps\web\app\page.tsx"
if (-not (Test-Path $pagePath)) {
    Write-Host "Could not find $pagePath - run this from the repo root." -ForegroundColor Red
    exit 1
}
$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $pagePath).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old1 = @'
import { apiFetch } from "./lib/api";
'@
$new1 = @'
import { apiFetch } from "./lib/api";
import Header from "./Header";
'@
$content = Apply-Edit $content $old1 $new1 "import Header in page.tsx"

$old2 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);
'@
$new2 = @'
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "postdemand" || tab === "ecommerce" || tab === "professionals" || tab === "logistics") {
      setActiveTab(tab);
    }
  }, []);
'@
$content = Apply-Edit $content $old2 $new2 "sync ?tab= query param on load"

$old3 = @'
      <header className="relative flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
        <span className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
          DEMAND//BOARD
        </span>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="font-body text-sm text-rv-magenta transition hover:text-rv-text"
                >
                  Admin
                </Link>
              )}
              {user.role === "co_admin" && (
                <Link
                  href="/co-admin"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  Co-Admin
                </Link>
              )}
              {user.role === "co_supplier" && (
                <Link
                  href="/co-supplier"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  Stores I manage
                </Link>
              )}
              {user.role === "employee" && (
                <Link
                  href="/employee"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  My tasks
                </Link>
              )}
              <Link
                href="/reviews"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Reviews
              </Link>
              <Link
                href="/favorites"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Favorites
              </Link>
              {user.role === "seller" && (
                <Link
                  href="/returns"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Returns
                </Link>
              )}
              {(user.role === "seller" || user.role === "delivery") && (
                <Link
                  href="/kyc"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Verification
                </Link>
              )}
              {user.role === "seller" && (
                <Link
                  href="/store/new"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Open a store
                </Link>
              )}
              {user.role === "professional" && (
                <Link
                  href="/professional/skills"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  My skills
                </Link>
              )}
              {user.role === "delivery" && (
                <Link
                  href="/deliveries"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Deliveries
                </Link>
              )}
              <Link
                href="/notifications"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Notifications
              </Link>
              <Link
                href="/wallet"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Wallet
              </Link>
              <Link
                href="/orders"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                My orders
              </Link>
              <Link
                href="/profile"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                {user.name} · {user.role}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-rv-magenta px-4 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
'@
$new3 = @'
      <Header />
'@
$content = Apply-Edit $content $old3 $new3 "replace inline header with shared <Header />"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }
[System.IO.File]::WriteAllText((Resolve-Path $pagePath).Path, $content, $utf8NoBom)
Write-Host "Done writing page.tsx" -ForegroundColor Cyan

# -------------------------------------------------------------------
# 4. Patch apps\web\app\login\page.tsx: use <Header />, drop duplicate Footer
# -------------------------------------------------------------------
$loginPath = "apps\web\app\login\page.tsx"
if (-not (Test-Path $loginPath)) {
    Write-Host "Could not find $loginPath - run this from the repo root." -ForegroundColor Red
    exit 1
}
$rawLogin = [System.IO.File]::ReadAllText((Resolve-Path $loginPath).Path)
$hadCrLfLogin = $rawLogin.Contains("`r`n")
$loginContent = $rawLogin.Replace("`r`n", "`n")

$lold1 = @'
import { apiFetch } from "../lib/api";
import Footer from "../Footer";
'@
$lnew1 = @'
import { apiFetch } from "../lib/api";
import Header from "../Header";
'@
$loginContent = Apply-Edit $loginContent $lold1 $lnew1 "swap Footer import for Header import in login page"

$lold2 = @'
      <header className="flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
        <Link href="/" className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
          DEMAND//BOARD
        </Link>
        <Link
          href="/"
          className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
        >
          Home
        </Link>
      </header>
'@
$lnew2 = @'
      <Header />
'@
$loginContent = Apply-Edit $loginContent $lold2 $lnew2 "replace login page header with shared <Header />"

$lold3 = @'
      <Footer />
    </div>
  );
}
'@
$lnew3 = @'
    </div>
  );
}
'@
$loginContent = Apply-Edit $loginContent $lold3 $lnew3 "remove duplicate <Footer /> (already global in layout.tsx)"

if ($hadCrLfLogin) { $loginContent = $loginContent.Replace("`n", "`r`n") }
[System.IO.File]::WriteAllText((Resolve-Path $loginPath).Path, $loginContent, $utf8NoBom)
Write-Host "Done writing login\page.tsx" -ForegroundColor Cyan

# -------------------------------------------------------------------
# 5. Add a simple About Us page, since the header now links to /about
# -------------------------------------------------------------------
$aboutDir = "apps\web\app\about"
$aboutPath = "$aboutDir\page.tsx"
if (-not (Test-Path $aboutPath)) {
    New-Item -ItemType Directory -Force -Path $aboutDir | Out-Null
    $aboutContent = @'
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-16 md:px-16">
      <h1 className="font-display text-3xl font-semibold text-rv-text">About Demand Board</h1>
      <p className="mt-4 font-body text-sm leading-relaxed text-rv-text-dim">
        Demand Board is a reverse marketplace: instead of searching endlessly through listings, you post what you
        need and let sellers, professionals, and delivery partners come to you with offers.
      </p>
      <p className="mt-4 font-body text-sm leading-relaxed text-rv-text-dim">
        We bring together everyday commerce, local professionals, and logistics into one place, so you can post a
        demand, shop from nearby stores, book a service, or arrange a delivery, all from a single account.
      </p>
    </main>
  );
}
'@
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $aboutPath), $aboutContent, $utf8NoBom)
    Write-Host "Created $aboutPath" -ForegroundColor Green
} else {
    Write-Host "$aboutPath already exists - left untouched" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "All done. Check above for any FAILED lines." -ForegroundColor Cyan
