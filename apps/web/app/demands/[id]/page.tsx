"use client";

import { useEffect, useState, use } from "react";
import { apiFetch, trackEvent } from "../../lib/api";

interface Demand {
  id: number;
  title: string;
  description: string | null;
  budget: number | null;
  status: string;
  category: string | null;
  buyerId: number;
}

interface Bid {
  id: number;
  amount: number;
  message: string | null;
  status: string;
  sellerId: number;
}

interface User {
  id: number;
  role: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function DemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const demandsData = await apiFetch(`/demands`);
      const found = demandsData.find((d: Demand) => d.id === Number(id));
      setDemand(found ?? null);

      const token = localStorage.getItem("token");
      if (token) {
        const bidsData = await apiFetch(`/demands/${id}/bids`);
        setBids(bidsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleBidSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await apiFetch("/bids", {
        method: "POST",
        body: JSON.stringify({
          demandId: Number(id),
          amount: Number(bidAmount),
          message: bidMessage || undefined,
        }),
      });
      setBidAmount("");
      setBidMessage("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(bidId: number) {
    setError("");
    try {
      const order = await apiFetch(`/bids/${bidId}/accept`, { method: "POST" });
      trackEvent("order_created", { value: order.amount });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleReject(bidId: number) {
    setError("");
    try {
      await apiFetch(`/bids/${bidId}/reject`, { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handlePayFeeWallet() {
    setError("");
    try {
      await apiFetch(`/demands/${id}/pay-fee`, {
        method: "POST",
        body: JSON.stringify({ method: "wallet" }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handlePayFeeRazorpay() {
    setError("");
    try {
      const order = await apiFetch(`/demands/${id}/pay-fee`, {
        method: "POST",
        body: JSON.stringify({ method: "razorpay" }),
      });

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Demand Board",
        description: "Booking fee",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await apiFetch(`/demands/${id}/verify-fee-payment`, {
              method: "POST",
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            await loadData();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleCancel() {
    setError("");
    try {
      await apiFetch(`/demands/${id}/cancel`, { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  if (!demand) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Demand not found.</div>;
  }

  const isOwner = user?.id === demand.buyerId;
  const canBid = user && (user.role === "seller" || user.role === "worker") && demand.status === "open";

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-indigo-surface p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-paper">{demand.title}</h1>
              {demand.category && (
                <span className="mt-2 inline-block rounded-full bg-marigold/15 px-2.5 py-0.5 font-body text-xs text-marigold">
                  {demand.category}
                </span>
              )}
            </div>
            <span className="whitespace-nowrap rounded-full border border-indigo-border px-3 py-1 font-body text-xs text-indigo-border">
              {demand.status}
            </span>
          </div>
          {demand.description && (
            <p className="mt-4 font-body text-sm leading-relaxed text-indigo-border">
              {demand.description}
            </p>
          )}
          {demand.budget && (
            <p className="mt-4 font-display text-xl font-semibold text-marigold">₹{demand.budget}</p>
          )}

          {isOwner && demand.status === "open" && bids.length === 0 && (
            <button
              onClick={handleCancel}
              className="mt-4 rounded-md border border-red-400/50 px-4 py-2 font-body text-sm text-red-300 transition hover:bg-red-500/10"
            >
              Cancel demand &amp; refund booking fee
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
            {error}
          </p>
        )}

        {isOwner && demand.status === "pending_payment" && (
          <div className="mt-6 rounded-lg bg-paper p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Pay booking fee</h2>
            <p className="mt-1 font-body text-sm text-ink/70">
              Your demand is posted but not yet visible to sellers until the fee is paid.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handlePayFeeWallet}
                className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface"
              >
                Pay from wallet
              </button>
              <button
                onClick={handlePayFeeRazorpay}
                className="rounded-md border border-ink/20 px-4 py-2.5 font-body font-medium text-ink transition hover:border-marigold"
              >
                Pay with Razorpay
              </button>
            </div>
          </div>
        )}

        {canBid && (
          <form onSubmit={handleBidSubmit} className="mt-6 rounded-lg bg-paper p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Submit a bid</h2>
            <div className="mt-4 flex flex-col gap-4">
              <input
                type="number"
                min={1}
                required
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Your price (₹)"
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
              <textarea
                rows={2}
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder="Message (optional)"
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit bid"}
              </button>
            </div>
          </form>
        )}

        {isOwner && (
          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold text-paper">Bids received</h2>
            {bids.length === 0 && (
              <p className="mt-3 font-body text-sm text-indigo-border">No bids yet.</p>
            )}
            <div className="mt-3 flex flex-col gap-3">
              {bids.map((bid) => (
                <div key={bid.id} className="rounded-lg bg-indigo-surface p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold text-marigold">₹{bid.amount}</span>
                    <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
                      {bid.status}
                    </span>
                  </div>
                  {bid.message && (
                    <p className="mt-2 font-body text-sm text-indigo-border">{bid.message}</p>
                  )}
                  {bid.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        className="rounded-md bg-marigold px-3 py-1.5 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        className="rounded-md border border-indigo-border px-3 py-1.5 font-body text-sm text-paper transition hover:border-red-400 hover:text-red-300"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}