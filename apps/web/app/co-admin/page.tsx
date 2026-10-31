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

interface StoreBenchmark {
  storeId: number;
  storeName: string;
  productCount: number;
  avgPrice: number;
  avgRating: number | null;
  unitsSold: number;
}

interface CategoryBenchmark {
  category: string;
  productCount: number;
  storeCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stores: StoreBenchmark[];
}

export default function CoAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingKyc, setPendingKyc] = useState<KycDoc[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "orders" | "kyc" | "settings" | "benchmarks" | "stores">("users");

  const [referralReward, setReferralReward] = useState("");

  const [categories, setCategories] = useState<CategoryBenchmark[]>([]);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [myStores, setMyStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "benchmarks") {
      loadBenchmarks();
    }
    if (tab === "stores") {
      loadMyStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  async function loadBenchmarks() {
    setLoadingBenchmarks(true);
    setBenchmarksError("");
    try {
      const data = await apiFetch("/co-admin/benchmarks");
      setCategories(data.categories);
    } catch (err) {
      setBenchmarksError(err instanceof Error ? err.message : "Failed to load benchmarks");
    } finally {
      setLoadingBenchmarks(false);
    }
  }

  async function loadMyStores() {
    setLoadingStores(true);
    setStoresError("");
    try {
      const data = await apiFetch("/co-admin/stores");
      setMyStores(data);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }

  async function handleToggleStoreActive(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/co-admin/stores/${storeId}/toggle-active`, { method: "POST" });
      await loadMyStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleTogglePrintService(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/co-admin/stores/${storeId}/toggle-print-service`, { method: "POST" });
      await loadMyStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSetReferralReward(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/co-admin/settings/referral-reward", {
        method: "POST",
        body: JSON.stringify({ amount: Number(referralReward) }),
      });
      setMessage("Referral reward updated.");
      setReferralReward("");
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
          {(["users", "orders", "kyc", "settings", "benchmarks", "stores"] as const).map((t) => (
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

        {tab === "benchmarks" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Benchmarks compare stores against each other within this marketplace, by category â€” there is no data
              from outside sellers or other platforms.
            </p>
            {benchmarksError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{benchmarksError}</p>
            )}
            {loadingBenchmarks && <p className="font-body text-sm text-rv-text-dim">Loading benchmarks...</p>}
            {!loadingBenchmarks && categories.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No active products to benchmark yet.</p>
            )}
            {categories.map((c) => (
              <div key={c.category} className="glass-panel px-5 py-4">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === c.category ? null : c.category)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-body text-sm capitalize text-rv-text">{c.category}</p>
                    <p className="font-body text-xs text-rv-text-dim">
                      {c.storeCount} store{c.storeCount === 1 ? "" : "s"} Â· {c.productCount} product{c.productCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-semibold text-rv-magenta">
                      â‚¹{c.minPrice} â€“ â‚¹{c.maxPrice}
                    </p>
                    <p className="font-body text-xs text-rv-text-dim">avg â‚¹{c.avgPrice}</p>
                  </div>
                </button>

                {expandedCategory === c.category && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-rv-border pt-4">
                    {c.stores
                      .slice()
                      .sort((a, b) => b.unitsSold - a.unitsSold)
                      .map((s) => (
                        <div key={s.storeId} className="flex items-center justify-between rounded-md bg-rv-panel/50 px-4 py-2">
                          <div>
                            <p className="font-body text-sm text-rv-text">{s.storeName}</p>
                            <p className="font-body text-xs text-rv-text-dim">
                              {s.productCount} product{s.productCount === 1 ? "" : "s"} Â· avg â‚¹{s.avgPrice}
                              {s.avgRating !== null ? ` Â· â˜… ${s.avgRating.toFixed(1)}` : " Â· no ratings yet"}
                            </p>
                          </div>
                          <span className="font-body text-xs text-rv-text-dim">{s.unitsSold} sold</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "stores" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Only stores whose seller is in your city are shown here.
            </p>
            {storesError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{storesError}</p>
            )}
            {loadingStores && <p className="font-body text-sm text-rv-text-dim">Loading stores...</p>}
            {!loadingStores && myStores.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No stores found in your city.</p>
            )}
            {myStores.map((s) => (
              <div key={s.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">{s.name}</p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Seller: {s.sellerName} Â·{" "}
                    <span className={s.isActive ? "text-rv-cyan" : "text-rv-danger"}>{s.isActive ? "Active" : "Deactivated"}</span>
                    {" Â· Print service: "}
                    <span className={s.offersPrintService ? "text-rv-cyan" : "text-rv-text-dim"}>
                      {s.offersPrintService ? "On" : "Off"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStoreActive(s.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {s.isActive ? "Deactivate store" : "Activate store"}
                  </button>
                  <button
                    onClick={() => handleTogglePrintService(s.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {s.offersPrintService ? "Turn off print service" : "Turn on print service"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div className="mt-6">
            <p className="mb-4 font-body text-xs text-rv-text-dim">
              This is a platform-wide setting, not scoped to your city — changes here affect all users.
            </p>
            <form onSubmit={handleSetReferralReward} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">Referral reward (₹, each side)</h2>
              <p className="mt-1 font-body text-xs text-rv-text-dim">
                Both the referrer and the new signup receive this amount when a referral code is used.
              </p>
              <div className="mt-3 flex gap-3">
                <input
                  type="number"
                  min={0}
                  required
                  value={referralReward}
                  onChange={(e) => setReferralReward(e.target.value)}
                  placeholder="e.g. 20"
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button type="submit" className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90">
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