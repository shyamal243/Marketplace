"use client";

import { useEffect, useState, use } from "react";
import { apiFetch } from "../../lib/api";

interface Order {
  id: number;
  amount: number;
  status: string;
  isPaid: boolean;
  buyerId: number;
  sellerId: number;
  orderType: string;
}

interface User {
  id: number;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("courier");
  const [deliveryPersonId, setDeliveryPersonId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadOrder();
  }, [id]);

  async function loadOrder() {
    setLoading(true);
    try {
      const data = await apiFetch("/orders/mine");
      const found = [...data.asBuyer, ...data.asSeller].find((o: Order) => o.id === Number(id));
      setOrder(found ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleShip(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> =
        deliveryMode === "local"
          ? { deliveryMode: "local", deliveryPersonId: Number(deliveryPersonId) }
          : { deliveryMode: "courier", trackingNumber, courierName };

      await apiFetch(`/orders/${id}/ship`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Marked as shipped.");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeliver() {
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/orders/${id}/deliver`, { method: "POST" });
      setMessage("Marked as delivered.");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/orders/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      setMessage("Review submitted, thank you!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  if (!order) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Order not found.</div>;
  }

  const isBuyer = user?.id === order.buyerId;
  const isSeller = user?.id === order.sellerId;

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-lg bg-indigo-surface p-6 md:p-8">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-semibold text-marigold">₹{order.amount}</span>
            <span className="rounded-full border border-indigo-border px-3 py-1 font-body text-xs text-indigo-border">
              {order.status}
            </span>
          </div>
          <p className="mt-2 font-body text-sm text-indigo-border">
            Order #{order.id} · {order.isPaid ? "Paid" : "Payment pending"}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        {isSeller && order.status === "confirmed" && (
          <form onSubmit={handleShip} className="mt-6 rounded-lg bg-paper p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Ship this order</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("local")}
                className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                  deliveryMode === "local"
                    ? "border-marigold bg-marigold/10 text-ink"
                    : "border-ink/15 bg-white text-ink/70 hover:border-ink/30"
                }`}
              >
                Local delivery
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("courier")}
                className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                  deliveryMode === "courier"
                    ? "border-marigold bg-marigold/10 text-ink"
                    : "border-ink/15 bg-white text-ink/70 hover:border-ink/30"
                }`}
              >
                Courier
              </button>
            </div>

            {deliveryMode === "local" ? (
              <input
                type="number"
                required
                value={deliveryPersonId}
                onChange={(e) => setDeliveryPersonId(e.target.value)}
                placeholder="Delivery person's user ID"
                className="mt-4 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <input
                  type="text"
                  required
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="Courier name (e.g. Delhivery)"
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Tracking number"
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={actionLoading}
              className="mt-4 w-full rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
            >
              {actionLoading ? "Shipping..." : "Confirm shipment"}
            </button>
          </form>
        )}

        {isBuyer && order.status === "shipped" && (
          <button
            onClick={handleDeliver}
            disabled={actionLoading}
            className="mt-6 w-full rounded-md bg-marigold px-4 py-2.5 font-body font-medium text-indigo-deep transition hover:opacity-90 disabled:opacity-60"
          >
            Confirm delivery
          </button>
        )}

        {isBuyer && order.status === "delivered" && (
          <form onSubmit={handleReview} className="mt-6 rounded-lg bg-paper p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Leave a review</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`text-2xl ${n <= rating ? "text-marigold" : "text-ink/20"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was it? (optional)"
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
              >
                Submit review
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
