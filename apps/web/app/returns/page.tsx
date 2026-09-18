"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

interface ReturnRequest {
  id: number;
  orderId: number;
  reason: string;
  status: string;
}

export default function SellerReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    setLoading(true);
    try {
      const data = await apiFetch("/returns/for-seller");
      setReturns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(returnId: number, decision: "approved" | "rejected") {
    setActionLoading(returnId);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/returns/${returnId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMessage(`Return ${decision}.`);
      setReturns((prev) => prev.filter((r) => r.id !== returnId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Return requests</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Review and decide on returns for your orders.
        </p>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        {!loading && returns.length === 0 && (
          <p className="mt-8 font-body text-sm text-rv-text-dim">No pending return requests.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {returns.map((r) => (
            <div key={r.id} className="glass-panel p-5">
              <div className="flex items-center justify-between">
                <Link href={`/orders/${r.orderId}`} className="font-body text-sm text-rv-cyan underline">
                  Order #{r.orderId}
                </Link>
                <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs text-rv-text-dim">
                  {r.status}
                </span>
              </div>
              <p className="mt-2 font-body text-sm text-rv-text">{r.reason}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDecision(r.id, "approved")}
                  disabled={actionLoading === r.id}
                  className="rounded-md bg-rv-cyan px-3 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(r.id, "rejected")}
                  disabled={actionLoading === r.id}
                  className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:border-rv-danger hover:text-rv-danger disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}