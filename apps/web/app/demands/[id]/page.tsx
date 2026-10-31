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

interface MyProduct {
  id: number;
  name: string;
  price: number;
  storeId: number;
}

interface Bid {
  id: number;
  amount: number;
  message: string | null;
  status: string;
  sellerId: number;
  linkedProductId: number | null;
  linkedProduct: MyProduct | null;
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
  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    loadData();
  }, [id]);

  useEffect(() => {
    if (user && user.role === "seller") {
      loadMyProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadMyProducts() {
    try {
      const data = await apiFetch("/products/mine");
      setMyProducts(data);
    } catch {
      // not critical to the page - just means no product picker is shown
    }
  }

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
          productId: selectedProductId ? Number(selectedProductId) : undefined,
        }),
      });
      setBidAmount("");
      setBidMessage("");
      setSelectedProductId("");
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
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  if (!demand) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Demand not found.</div>;
  }

  const isOwner = user?.id === demand.buyerId;
  const canBid = user && (user.role === "seller" || user.role === "professional") && demand.status === "open";

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <div className="glass-panel p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-rv-text">{demand.title}</h1>
              {demand.category && (
                <span className="mt-2 inline-block rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                  {demand.category}
                </span>
              )}
            </div>
            <span className="whitespace-nowrap rounded-full border border-rv-border px-3 py-1 font-body text-xs text-rv-text-dim">
              {demand.status}
            </span>
          </div>
          {demand.description && (
            <p className="mt-4 font-body text-sm leading-relaxed text-rv-text-dim">
              {demand.description}
            </p>
          )}
          {demand.budget && (
            <p className="mt-4 font-display text-xl font-semibold text-rv-magenta">₹{demand.budget}</p>
          )}

          {isOwner && demand.status === "open" && bids.length === 0 && (
            <button
              onClick={handleCancel}
              className="mt-4 rounded-md border border-rv-danger/50 px-4 py-2 font-body text-sm text-rv-danger transition hover:bg-rv-danger/10"
            >
              Cancel demand &amp; refund booking fee
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {isOwner && demand.status === "pending_payment" && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Pay booking fee</h2>
            <p className="mt-1 font-body text-sm text-rv-text-dim">
              Your demand is posted but not yet visible to sellers until the fee is paid.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handlePayFeeWallet}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
              >
                Pay from wallet
              </button>
              <button
                onClick={handlePayFeeRazorpay}
                className="rounded-md border border-rv-border px-4 py-2.5 font-body font-medium text-rv-text transition hover:hud-border hover:text-rv-cyan"
              >
                Pay with Razorpay
              </button>
            </div>
          </div>
        )}

        {canBid && (
          <form onSubmit={handleBidSubmit} className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Submit a bid</h2>
            <div className="mt-4 flex flex-col gap-4">
              <input
                type="number"
                min={1}
                required
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Your price (₹)"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <textarea
                rows={2}
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder="Message (optional)"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              {myProducts.length > 0 && (
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="">Link one of your products (optional)</option>
                  {myProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - â‚¹{p.price}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit bid"}
              </button>
            </div>
          </form>
        )}

        {isOwner && (
          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Bids received</h2>
            {bids.length === 0 && (
              <p className="mt-3 font-body text-sm text-rv-text-dim">No bids yet.</p>
            )}
            <div className="mt-3 flex flex-col gap-3">
              {bids.map((bid) => (
                <div key={bid.id} className="glass-panel p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold text-rv-magenta">₹{bid.amount}</span>
                    <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs text-rv-text-dim">
                      {bid.status}
                    </span>
                  </div>
                  {bid.message && (
                    <p className="mt-2 font-body text-sm text-rv-text-dim">{bid.message}</p>
                  )}
                  {bid.linkedProduct && (
                    <a
                      href={`/stores/${bid.linkedProduct.storeId}`}
                      className="mt-2 inline-block rounded-md border border-rv-cyan/30 bg-rv-cyan/10 px-3 py-1.5 font-body text-xs text-rv-cyan transition hover:bg-rv-cyan/20"
                    >
                      Linked product: {bid.linkedProduct.name} (â‚¹{bid.linkedProduct.price}) - view in store â†’
                    </a>
                  )}
                  {bid.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAccept(bid.id)}
                        className="rounded-md bg-rv-cyan px-3 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(bid.id)}
                        className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:border-rv-danger hover:text-rv-danger"
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