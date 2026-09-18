"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Transaction {
  id: number;
  amount: number;
  type: string;
  reason: string;
  createdAt: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupAmount, setTopupAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    setLoading(true);
    try {
      const data = await apiFetch("/wallet");
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const amount = Number(topupAmount);
      const order = await apiFetch("/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Demand Board",
        description: "Wallet top-up",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await apiFetch("/wallet/verify-topup", {
              method: "POST",
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                amount,
              }),
            });
            setMessage("Wallet topped up successfully!");
            setTopupAmount("");
            await loadWallet();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
          }
        },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Your wallet</h1>

        {loading ? (
          <p className="mt-8 font-body text-rv-text-dim">Loading...</p>
        ) : (
          <>
            <div className="hud-border glass-panel mt-6 p-6 md:p-8 hud-scanline">
              <p className="font-body text-sm text-rv-text-dim">Current balance</p>
              <p className="mt-1 font-display text-4xl font-semibold text-rv-cyan">â‚¹{balance}</p>
            </div>

            {error && (
              <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
                {error}
              </p>
            )}
            {message && (
              <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">
                {message}
              </p>
            )}

            <form onSubmit={handleTopup} className="glass-panel mt-6 p-6">
              <h2 className="font-display text-lg font-semibold text-rv-text">Add money</h2>
              <div className="mt-4 flex gap-3">
                <input
                  type="number"
                  min={1}
                  required
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Amount (â‚¹)"
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button
                  type="submit"
                  className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
                >
                  Add via Razorpay
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold text-rv-text">Transaction history</h2>
              {transactions.length === 0 ? (
                <p className="mt-3 font-body text-sm text-rv-text-dim">No transactions yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {transactions.map((t) => (
                    <div
                      key={t.id}
                      className="glass-panel flex items-center justify-between px-5 py-3"
                    >
                      <div>
                        <p className="font-body text-sm text-rv-text">{t.reason.replace(/_/g, " ")}</p>
                        <p className="font-body text-xs text-rv-text-dim">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`font-display text-lg font-semibold ${
                          t.type === "credit" ? "text-rv-cyan" : "text-rv-danger"
                        }`}
                      >
                        {t.type === "credit" ? "+" : "-"}â‚¹{t.amount}
                      </span>
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