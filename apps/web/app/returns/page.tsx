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
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Return requests</h1>
        <p className="mt-2 font-body text-sm text-indigo-border">
          Review and decide on returns for your orders.
        </p>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}
        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        {!loading && returns.length === 0 && (
          <p className="mt-8 font-body text-sm text-indigo-border">No pending return requests.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {returns.map((r) => (
            <div key={r.id} className="rounded-lg bg-indigo-surface p-5">
              <div className="flex items-center justify-between">
                <Link href={`/orders/${r.orderId}`} className="font-body text-sm text-marigold underline">
                  Order #{r.orderId}
                </Link>
                <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
                  {r.status}
                </span>
              </div>
              <p className="mt-2 font-body text-sm text-paper">{r.reason}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDecision(r.id, "approved")}
                  disabled={actionLoading === r.id}
                  className="rounded-md bg-marigold px-3 py-1.5 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(r.id, "rejected")}
                  disabled={actionLoading === r.id}
                  className="rounded-md border border-indigo-border px-3 py-1.5 font-body text-sm text-paper transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
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
