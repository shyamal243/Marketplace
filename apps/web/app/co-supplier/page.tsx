"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

interface Store {
  id: number;
  name: string;
  address: string | null;
}

export default function CoSupplierPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    setLoading(true);
    try {
      const data = await apiFetch("/co-supplier/stores");
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load — are you a co-supplier?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Stores you manage</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          You&apos;ve been given access to manage these stores on behalf of their sellers.
        </p>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {!loading && !error && stores.length === 0 && (
          <p className="mt-8 font-body text-rv-text-dim">
            No stores assigned to you yet. A seller needs to grant you access from their store page.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/stores/${s.id}`}
              className="glass-panel block px-5 py-3 transition hover:hud-border"
            >
              <span className="font-body text-sm text-rv-text">{s.name}</span>
              {s.address && <p className="mt-1 font-body text-xs text-rv-text-dim">{s.address}</p>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}