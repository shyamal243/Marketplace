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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    apiFetch("/demands?status=open")
      .then((data) => setDemands(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-indigo-deep">
      <header className="flex items-center justify-between border-b border-indigo-border/40 px-8 py-5 md:px-16">
        <span className="font-display text-xl font-semibold text-paper">Demand Board</span>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="font-body text-sm text-marigold transition hover:text-paper"
                >
                  Admin
                </Link>
              )}
              {user.role === "seller" && (
                <Link
                  href="/store/new"
                  className="font-body text-sm text-indigo-border transition hover:text-paper"
                >
                  Open a store
                </Link>
              )}
              {user.role === "delivery" && (
                <Link
                  href="/deliveries"
                  className="font-body text-sm text-indigo-border transition hover:text-paper"
                >
                  Deliveries
                </Link>
              )}
              <Link
                href="/notifications"
                className="font-body text-sm text-indigo-border transition hover:text-paper"
              >
                Notifications
              </Link>
              <Link
                href="/wallet"
                className="font-body text-sm text-indigo-border transition hover:text-paper"
              >
                Wallet
              </Link>
              <Link
                href="/orders"
                className="font-body text-sm text-indigo-border transition hover:text-paper"
              >
                My orders
              </Link>
              <Link
                href="/profile"
                className="font-body text-sm text-indigo-border transition hover:text-paper"
              >
                {user.name} · {user.role}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border border-indigo-border/60 px-3 py-1.5 font-body text-sm text-paper transition hover:border-marigold hover:text-marigold"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-marigold px-4 py-1.5 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-12 md:px-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-paper">Open demands</h1>
          {user?.role === "buyer" && (
            <Link
              href="/demands/new"
              className="rounded-md bg-marigold px-4 py-2 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90"
            >
              Post a demand
            </Link>
          )}
        </div>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}

        {error && (
          <p className="mt-8 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && demands.length === 0 && (
          <p className="mt-8 font-body text-indigo-border">No open demands right now.</p>
        )}

        <div className="mt-8 flex flex-col gap-4">
          {demands.map((d) => (
            <Link
              key={d.id}
              href={`/demands/${d.id}`}
              className="block rounded-lg border border-indigo-border/40 bg-indigo-surface px-6 py-5 transition hover:border-marigold/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-paper">{d.title}</h2>
                  {d.description && (
                    <p className="mt-1 font-body text-sm text-indigo-border">{d.description}</p>
                  )}
                  {d.category && (
                    <span className="mt-2 inline-block rounded-full bg-marigold/15 px-2.5 py-0.5 font-body text-xs text-marigold">
                      {d.category}
                    </span>
                  )}
                </div>
                {d.budget && (
                  <span className="whitespace-nowrap font-display text-lg font-semibold text-marigold">
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
