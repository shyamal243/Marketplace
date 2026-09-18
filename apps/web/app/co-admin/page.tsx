"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  kycStatus: string;
  city?: string | null;
}

interface Order {
  id: number;
  amount: number;
  status: string;
  orderType: string;
}

interface KycDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  userId: number;
}

export default function CoAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingKyc, setPendingKyc] = useState<KycDoc[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "orders" | "kyc">("users");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [usersData, ordersData, kycData] = await Promise.all([
        apiFetch("/co-admin/users"),
        apiFetch("/co-admin/orders"),
        apiFetch("/co-admin/kyc/pending"),
      ]);
      setUsers(usersData);
      setOrders(ordersData);
      setPendingKyc(kycData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load — are you a co-admin?");
    } finally {
      setLoading(false);
    }
  }

  async function handleKycDecision(docId: number, decision: "approved" | "rejected") {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/co-admin/kyc/${docId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMessage(`Document ${decision}.`);
      setPendingKyc((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const myCity = users[0]?.city;

  if (loading) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Co-Admin dashboard</h1>
        {myCity && (
          <p className="mt-1 font-body text-sm text-rv-text-dim">
            Managing: <span className="text-rv-cyan">{myCity}</span>
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        <div className="mt-6 flex gap-2">
          {(["users", "orders", "kyc"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 font-body text-sm capitalize transition ${
                tab === t
                  ? "bg-rv-magenta text-rv-bg shadow-hud-glow-magenta"
                  : "border border-rv-border text-rv-text hover:hud-border hover:text-rv-cyan"
              }`}
            >
              {t === "kyc" ? `KYC (${pendingKyc.length})` : t}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="mt-6 flex flex-col gap-2">
            {users.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No users found in your city.</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">{u.name} · {u.email}</p>
                  <p className="font-body text-xs text-rv-text-dim">
                    {u.role} · KYC: {u.kycStatus}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 flex flex-col gap-2">
            {orders.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No orders found in your city.</p>
            )}
            {orders.map((o) => (
              <div key={o.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <span className="font-body text-sm text-rv-text">Order #{o.id} · {o.orderType}</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-rv-magenta">₹{o.amount}</span>
                  <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs text-rv-text-dim">
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
              <p className="font-body text-sm text-rv-text-dim">No pending KYC documents in your city.</p>
            )}
            {pendingKyc.map((d) => (
              <div key={d.id} className="glass-panel p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body text-sm capitalize text-rv-text">{d.documentType.replace(/_/g, " ")}</p>
                    <p className="font-body text-xs text-rv-text-dim">User #{d.userId}</p>
                    {d.documentNumber && (
                      <p className="mt-1 font-body text-xs text-rv-text-dim">Number: {d.documentNumber}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleKycDecision(d.id, "approved")}
                      className="rounded-md bg-rv-cyan px-3 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleKycDecision(d.id, "rejected")}
                      className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:border-rv-danger hover:text-rv-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}