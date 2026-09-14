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
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Store analytics</h1>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}

        {data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-indigo-surface p-5">
                <p className="font-body text-xs text-indigo-border">Total sales</p>
                <p className="mt-1 font-display text-2xl font-semibold text-marigold">₹{data.totalSales}</p>
              </div>
              <div className="rounded-lg bg-indigo-surface p-5">
                <p className="font-body text-xs text-indigo-border">Total orders</p>
                <p className="mt-1 font-display text-2xl font-semibold text-paper">{data.totalOrders}</p>
              </div>
              <div className="rounded-lg bg-indigo-surface p-5">
                <p className="font-body text-xs text-indigo-border">Delivered</p>
                <p className="mt-1 font-display text-2xl font-semibold text-paper">{data.deliveredOrders}</p>
              </div>
              <div className="rounded-lg bg-indigo-surface p-5">
                <p className="font-body text-xs text-indigo-border">Cancelled</p>
                <p className="mt-1 font-display text-2xl font-semibold text-paper">{data.cancelledOrders}</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold text-paper">Best-selling products</h2>
              {data.bestSellingProducts.length === 0 ? (
                <p className="mt-3 font-body text-sm text-indigo-border">No sales yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {data.bestSellingProducts.map((p) => (
                    <div key={p.productId} className="flex items-center justify-between rounded-lg bg-indigo-surface px-5 py-3">
                      <span className="font-body text-sm text-paper">{p.name}</span>
                      <span className="font-body text-xs text-indigo-border">{p.quantitySold} sold</span>
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