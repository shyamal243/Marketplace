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
            <span className="text-[10px]">â–¾</span>
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
              <span className="text-[10px]">â–¾</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-10 z-20 flex w-56 flex-col rounded-lg border border-rv-border bg-rv-bg-alt p-2 shadow-hud-glow">
                <span className="border-b border-rv-border px-3 py-2 font-body text-sm text-rv-text">
                  {user.name} Â· {user.role}
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