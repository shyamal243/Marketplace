"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

interface Order {
  id: number;
  amount: number;
  status: string;
  isPaid: boolean;
  orderType: string;
}

export default function OrdersPage() {
  const [asBuyer, setAsBuyer] = useState<Order[]>([]);
  const [asSeller, setAsSeller] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/orders/mine")
      .then((data) => {
        setAsBuyer(data.asBuyer);
        setAsSeller(data.asSeller);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function OrderCard({ order }: { order: Order }) {
    return (
      <Link
        href={`/orders/${order.id}`}
        className="glass-panel block px-6 py-4 transition hover:hud-border"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-rv-magenta">₹{order.amount}</span>
          <div className="flex items-center gap-2">
            {order.isPaid && (
              <span className="rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                Paid
              </span>
            )}
            <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs text-rv-text-dim">
              {order.status}
            </span>
          </div>
        </div>
        <p className="mt-1 font-body text-xs text-rv-text-dim">
          {order.orderType === "store_order" ? "Store order" : "Demand order"} · #{order.id}
        </p>
      </Link>
    );
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Your orders</h1>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-rv-text">As buyer</h2>
              {asBuyer.length === 0 ? (
                <p className="mt-3 font-body text-sm text-rv-text-dim">No orders yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {asBuyer.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-rv-text">As seller</h2>
              {asSeller.length === 0 ? (
                <p className="mt-3 font-body text-sm text-rv-text-dim">No orders yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {asSeller.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}