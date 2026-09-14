"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

interface Store {
  id: number;
  name: string;
  address: string | null;
  distanceKm: number;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  storeId: number;
}

export default function BrowseStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState("");
  const [locationDenied, setLocationDenied] = useState(false);

  function findNearbyStores() {
    setError("");
    setLoadingStores(true);
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
      setLoadingStores(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await apiFetch(
            `/stores/nearby?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&radiusKm=25`
          );
          setStores(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
          setLoadingStores(false);
        }
      },
      () => {
        setLocationDenied(true);
        setLoadingStores(false);
      }
    );
  }

  async function handleProductSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoadingProducts(true);
    try {
      const data = await apiFetch(`/products/search?search=${encodeURIComponent(productSearch)}`);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoadingProducts(false);
    }
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Browse stores &amp; products</h1>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-paper">Nearby stores</h2>
            <button
              onClick={findNearbyStores}
              disabled={loadingStores}
              className="rounded-md bg-marigold px-4 py-1.5 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingStores ? "Finding..." : "Use my location"}
            </button>
          </div>

          {locationDenied && (
            <p className="mt-3 font-body text-sm text-indigo-border">
              Location access was denied. Enable it in your browser to find nearby stores.
            </p>
          )}

          {stores.length === 0 && !loadingStores && !locationDenied && (
            <p className="mt-3 font-body text-sm text-indigo-border">
              Click &quot;Use my location&quot; to find stores near you.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {stores.map((s) => (
              <Link
                key={s.id}
                href={`/stores/${s.id}`}
                className="block rounded-lg border border-indigo-border/40 bg-indigo-surface px-5 py-3 transition hover:border-marigold/60"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-paper">{s.name}</span>
                  <span className="font-body text-xs text-indigo-border">{s.distanceKm} km</span>
                </div>
                {s.address && <p className="mt-1 font-body text-xs text-indigo-border">{s.address}</p>}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-paper">Search products</h2>
          <form onSubmit={handleProductSearch} className="mt-3 flex gap-2">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search for a product..."
              className="flex-1 rounded-md border border-indigo-border/40 bg-indigo-surface px-3 py-2 font-body text-paper outline-none focus:border-marigold"
            />
            <button
              type="submit"
              disabled={loadingProducts}
              className="rounded-md bg-marigold px-4 py-2 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingProducts ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="mt-3 flex flex-col gap-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/stores/${p.storeId}`}
                className="block rounded-lg border border-indigo-border/40 bg-indigo-surface px-5 py-3 transition hover:border-marigold/60"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-paper">{p.name}</span>
                  <span className="font-display text-sm font-semibold text-marigold">₹{p.price}</span>
                </div>
                {p.description && <p className="mt-1 font-body text-xs text-indigo-border">{p.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
