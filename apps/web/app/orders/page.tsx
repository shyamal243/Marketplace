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
        className="block rounded-lg border border-indigo-border/40 bg-indigo-surface px-6 py-4 transition hover:border-marigold/60"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-marigold">₹{order.amount}</span>
          <div className="flex items-center gap-2">
            {order.isPaid && (
              <span className="rounded-full bg-marigold/15 px-2.5 py-0.5 font-body text-xs text-marigold">
                Paid
              </span>
            )}
            <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
              {order.status}
            </span>
          </div>
        </div>
        <p className="mt-1 font-body text-xs text-indigo-border">
          {order.orderType === "store_order" ? "Store order" : "Demand order"} · #{order.id}
        </p>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Your orders</h1>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-paper">As buyer</h2>
              {asBuyer.length === 0 ? (
                <p className="mt-3 font-body text-sm text-indigo-border">No orders yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {asBuyer.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-paper">As seller</h2>
              {asSeller.length === 0 ? (
                <p className="mt-3 font-body text-sm text-indigo-border">No orders yet.</p>
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
