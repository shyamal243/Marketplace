"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Favorite {
  id: number;
  storeId: number | null;
  productId: number | null;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    setLoading(true);
    try {
      const data = await apiFetch("/favorites/mine");
      setFavorites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: number) {
    try {
      await apiFetch(`/favorites/${id}/remove`, { method: "POST" });
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Your favorites</h1>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}

        {!loading && !error && favorites.length === 0 && (
          <p className="mt-8 font-body text-indigo-border">
            No favorites yet. Visit a store or product and favorite it to see it here.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2">
          {favorites.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg bg-indigo-surface px-5 py-3">
              <span className="font-body text-sm text-paper">
                {f.storeId ? `Store #${f.storeId}` : `Product #${f.productId}`}
              </span>
              <button
                onClick={() => handleRemove(f.id)}
                className="font-body text-xs text-red-300 underline underline-offset-4 hover:text-red-200"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
