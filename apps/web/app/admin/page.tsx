"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  kycStatus: string;
}

interface Order {
  id: number;
  amount: number;
  status: string;
  orderType: string;
}

interface Earnings {
  totalEarnings: number;
  breakdownByType: Record<string, number>;
}

interface KycDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  fileUrl: string | null;
  userId: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [pendingKyc, setPendingKyc] = useState<KycDoc[]>([]);
  const [bookingFee, setBookingFee] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [gstCategory, setGstCategory] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings">("users");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [usersData, ordersData, earningsData, kycData] = await Promise.all([
        apiFetch("/admin/users"),
        apiFetch("/admin/orders"),
        apiFetch("/admin/earnings/platform?period=monthly"),
        apiFetch("/admin/kyc/pending"),
      ]);
      setUsers(usersData);
      setOrders(ordersData);
      setEarnings(earningsData);
      setPendingKyc(kycData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load — are you an admin?");
    } finally {
      setLoading(false);
    }
  }

  async function handleKycDecision(docId: number, decision: "approved" | "rejected") {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/admin/kyc/${docId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMessage(`Document ${decision}.`);
      setPendingKyc((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleViewFile(docId: number) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:4000/kyc/file/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not load file");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSetBookingFee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings/booking-fee", {
        method: "POST",
        body: JSON.stringify({ amount: Number(bookingFee) }),
      });
      setMessage("Booking fee updated.");
      setBookingFee("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSetCommission(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings/commission", {
        method: "POST",
        body: JSON.stringify({ percent: Number(commissionPercent) }),
      });
      setMessage("Commission updated.");
      setCommissionPercent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSetGstRate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/gst-rates", {
        method: "POST",
        body: JSON.stringify({ category: gstCategory, ratePercent: Number(gstRate) }),
      });
      setMessage(`GST rate set for "${gstCategory}".`);
      setGstCategory("");
      setGstRate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Admin dashboard</h1>

        {earnings && (
          <div className="mt-6 rounded-lg bg-indigo-surface p-6">
            <p className="font-body text-sm text-indigo-border">Platform earnings (this month)</p>
            <p className="mt-1 font-display text-3xl font-semibold text-marigold">
              ₹{earnings.totalEarnings}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(earnings.breakdownByType).map(([type, amount]) => (
                <span key={type} className="rounded-full border border-indigo-border px-3 py-1 font-body text-xs text-indigo-border">
                  {type.replace(/_/g, " ")}: ₹{amount}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        <div className="mt-6 flex gap-2">
          {(["users", "orders", "kyc", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 font-body text-sm capitalize transition ${
                tab === t
                  ? "bg-marigold text-indigo-deep"
                  : "border border-indigo-border/60 text-paper hover:border-marigold"
              }`}
            >
              {t === "kyc" ? `KYC (${pendingKyc.length})` : t}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="mt-6 flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-indigo-surface px-5 py-3">
                <div>
                  <p className="font-body text-sm text-paper">{u.name} · {u.email}</p>
                  <p className="font-body text-xs text-indigo-border">
                    {u.role} · KYC: {u.kycStatus}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-indigo-surface px-5 py-3">
                <span className="font-body text-sm text-paper">Order #{o.id} · {o.orderType}</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-marigold">₹{o.amount}</span>
                  <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "kyc" && (
          <div className="mt-6 flex flex-col gap-2">
            {pendingKyc.length === 0 && (
              <p className="font-body text-sm text-indigo-border">No pending KYC documents.</p>
            )}
            {pendingKyc.map((d) => (
              <div key={d.id} className="rounded-lg bg-indigo-surface p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body text-sm capitalize text-paper">{d.documentType.replace(/_/g, " ")}</p>
                    <p className="font-body text-xs text-indigo-border">User #{d.userId}</p>
                    {d.documentNumber && (
                      <p className="mt-1 font-body text-xs text-indigo-border">Number: {d.documentNumber}</p>
                    )}
                    {d.fileUrl && (
                      <button
                        onClick={() => handleViewFile(d.id)}
                        className="mt-1 inline-block font-body text-xs text-marigold underline"
                      >
                        View file
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleKycDecision(d.id, "approved")}
                      className="rounded-md bg-marigold px-3 py-1.5 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleKycDecision(d.id, "rejected")}
                      className="rounded-md border border-indigo-border px-3 py-1.5 font-body text-sm text-paper transition hover:border-red-400 hover:text-red-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div className="mt-6 flex flex-col gap-4">
            <form onSubmit={handleSetBookingFee} className="rounded-lg bg-paper p-6">
              <h2 className="font-display text-base font-semibold text-ink">Booking fee (₹)</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="number"
                  min={0}
                  required
                  value={bookingFee}
                  onChange={(e) => setBookingFee(e.target.value)}
                  placeholder="e.g. 10"
                  className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <button type="submit" className="rounded-md bg-indigo-deep px-4 py-2 font-body text-sm font-medium text-paper transition hover:bg-indigo-surface">
                  Save
                </button>
              </div>
            </form>

            <form onSubmit={handleSetCommission} className="rounded-lg bg-paper p-6">
              <h2 className="font-display text-base font-semibold text-ink">Commission (%)</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  placeholder="e.g. 5"
                  className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <button type="submit" className="rounded-md bg-indigo-deep px-4 py-2 font-body text-sm font-medium text-paper transition hover:bg-indigo-surface">
                  Save
                </button>
              </div>
            </form>

            <form onSubmit={handleSetGstRate} className="rounded-lg bg-paper p-6">
              <h2 className="font-display text-base font-semibold text-ink">GST rate by category</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="text"
                  required
                  value={gstCategory}
                  onChange={(e) => setGstCategory(e.target.value)}
                  placeholder="Category (e.g. clothing)"
                  className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <input
                  type="number"
                  min={0}
                  required
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  placeholder="Rate %"
                  className="w-24 rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <button type="submit" className="rounded-md bg-indigo-deep px-4 py-2 font-body text-sm font-medium text-paper transition hover:bg-indigo-surface">
                  Save
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
