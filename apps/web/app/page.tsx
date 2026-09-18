"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "./lib/api";

interface Demand {
  id: number;
  title: string;
  description: string | null;
  budget: number | null;
  status: string;
  category: string | null;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  role: string;
}

export default function HomePage() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    loadDemands();
  }, []);

  function loadDemands(searchVal?: string, maxBudgetVal?: string) {
    setLoading(true);
    let url = "/demands?status=open";
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;
    if (maxBudgetVal) url += `&maxBudget=${encodeURIComponent(maxBudgetVal)}`;

    apiFetch(url)
      .then((data) => setDemands(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadDemands(search, maxBudget);
  }

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
    <div className="min-h-screen bg-rv-bg hex-grid-bg">
      <header className="flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
        <span className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
          DEMAND//BOARD
        </span>
        <div className="flex items-center gap-4">
          {user ? (
            <>
                                                        {user.role === "employee" && (
                <Link
                  href="/employee"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  My tasks
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
{user.role === "co_admin" && (
                <Link
                  href="/co-admin"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  Co-Admin
                </Link>
              )}
{user.role === "admin" && (
                <Link
                  href="/admin"
                  className="font-body text-sm text-rv-magenta transition hover:text-rv-text"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/stores"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Browse stores
              </Link>
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

      <main className="mx-auto max-w-4xl px-8 py-12 md:px-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-rv-text tracking-wide">
            Open demands
          </h1>
          {user?.role === "buyer" && (
            <Link
              href="/demands/new"
              className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
            >
              Post a demand
            </Link>
          )}
        </div>

        <form onSubmit={handleFilter} className="mt-4 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search demands..."
            className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
          />
          <input
            type="number"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            placeholder="Max budget"
            className="w-32 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
          />
          <button
            type="submit"
            className="rounded-md border border-rv-border px-4 py-2 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
          >
            Filter
          </button>
        </form>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}

        {error && (
          <p className="mt-8 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {!loading && !error && demands.length === 0 && (
          <p className="mt-8 font-body text-rv-text-dim">No open demands right now.</p>
        )}

        <div className="mt-8 flex flex-col gap-4">
          {demands.map((d) => (
            <Link
              key={d.id}
              href={`/demands/${d.id}`}
              className="glass-panel block px-6 py-5 transition hover:hud-border"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-rv-text">{d.title}</h2>
                  {d.description && (
                    <p className="mt-1 font-body text-sm text-rv-text-dim">{d.description}</p>
                  )}
                  {d.category && (
                    <span className="mt-2 inline-block rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                      {d.category}
                    </span>
                  )}
                </div>
                {d.budget && (
                  <span className="whitespace-nowrap font-display text-lg font-semibold text-rv-magenta">
                    ₹{d.budget}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}