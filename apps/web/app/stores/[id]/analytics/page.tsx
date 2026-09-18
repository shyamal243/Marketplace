"use client";

import { useEffect, useState, use } from "react";
import { apiFetch } from "../../../lib/api";

interface Analytics {
  totalOrders: number;
  totalSales: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  bestSellingProducts: { productId: number; name: string; quantitySold: number }[];
}

export default function StoreAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/stores/${id}/analytics`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Store analytics</h1>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}

        {data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="glass-panel hud-border p-5 hud-scanline">
                <p className="font-body text-xs text-rv-text-dim">Total sales</p>
                <p className="mt-1 font-display text-2xl font-semibold text-rv-cyan">₹{data.totalSales}</p>
              </div>
              <div className="glass-panel p-5">
                <p className="font-body text-xs text-rv-text-dim">Total orders</p>
                <p className="mt-1 font-display text-2xl font-semibold text-rv-text">{data.totalOrders}</p>
              </div>
              <div className="glass-panel p-5">
                <p className="font-body text-xs text-rv-text-dim">Delivered</p>
                <p className="mt-1 font-display text-2xl font-semibold text-rv-text">{data.deliveredOrders}</p>
              </div>
              <div className="glass-panel p-5">
                <p className="font-body text-xs text-rv-text-dim">Cancelled</p>
                <p className="mt-1 font-display text-2xl font-semibold text-rv-text">{data.cancelledOrders}</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold text-rv-text">Best-selling products</h2>
              {data.bestSellingProducts.length === 0 ? (
                <p className="mt-3 font-body text-sm text-rv-text-dim">No sales yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {data.bestSellingProducts.map((p) => (
                    <div key={p.productId} className="glass-panel flex items-center justify-between px-5 py-3">
                      <span className="font-body text-sm text-rv-text">{p.name}</span>
                      <span className="font-body text-xs text-rv-text-dim">{p.quantitySold} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}