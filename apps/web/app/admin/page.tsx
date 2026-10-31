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

interface Task {
  id: number;
  assignedToId: number;
  taskType: string;
  relatedUserId: number | null;
  title: string;
  description: string | null;
  status: string;
  notes: string | null;
}

const TASK_TYPES = [
  { value: "verify_store", label: "Verify store" },
  { value: "verify_seller", label: "Verify seller (training + documents)" },
  { value: "verify_delivery_partner", label: "Verify delivery partner (documents + vehicle)" },
  { value: "verify_professional", label: "Verify professional (training)" },
  { value: "other", label: "Other" },
];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [pendingKyc, setPendingKyc] = useState<KycDoc[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookingFee, setBookingFee] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [gstCategory, setGstCategory] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [referralReward, setReferralReward] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "orders" | "kyc" | "tasks" | "settings" | "coupons" | "risk" | "privacy" | "stores">("users");

  const [promotingUserId, setPromotingUserId] = useState<number | null>(null);
  const [promoteCity, setPromoteCity] = useState("");

  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDescription, setCouponDescription] = useState("");
  const [couponRewardType, setCouponRewardType] = useState<"discount" | "cashback">("discount");
  const [couponValueType, setCouponValueType] = useState<"flat" | "percent">("flat");
  const [couponValue, setCouponValue] = useState("");
  const [couponMaxDiscount, setCouponMaxDiscount] = useState("");
  const [couponMinOrder, setCouponMinOrder] = useState("");
  const [couponUsageLimit, setCouponUsageLimit] = useState("");
  const [couponPerUserLimit, setCouponPerUserLimit] = useState("1");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [loadingRiskFlags, setLoadingRiskFlags] = useState(false);
  const [riskError, setRiskError] = useState("");

  const [dataRequests, setDataRequests] = useState<any[]>([]);
  const [loadingDataRequests, setLoadingDataRequests] = useState(false);
  const [dataRequestsError, setDataRequestsError] = useState("");

  const [stores, setStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState("");

  const [taskAssignedToId, setTaskAssignedToId] = useState("");
  const [taskType, setTaskType] = useState("verify_store");
  const [taskRelatedUserId, setTaskRelatedUserId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "coupons") {
      loadCoupons();
    }
    if (tab === "risk") {
      loadRiskFlags();
    }
    if (tab === "privacy") {
      loadDataRequests();
    }
    if (tab === "stores") {
      loadStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [usersData, ordersData, earningsData, kycData, tasksData] = await Promise.all([
        apiFetch("/admin/users"),
        apiFetch("/admin/orders"),
        apiFetch("/admin/earnings/platform?period=monthly"),
        apiFetch("/admin/kyc/pending"),
        apiFetch("/admin/tasks"),
      ]);
      setUsers(usersData);
      setOrders(ordersData);
      setEarnings(earningsData);
      setPendingKyc(kycData);
      setTasks(tasksData);
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

  async function handlePromoteToCoAdmin(userId: number) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/admin/users/${userId}/promote-co-admin`, {
        method: "POST",
        body: JSON.stringify({ city: promoteCity }),
      });
      setMessage("User promoted to Co-Admin.");
      setPromotingUserId(null);
      setPromoteCity("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDemoteCoAdmin(userId: number) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/admin/users/${userId}/demote-co-admin`, { method: "POST" });
      setMessage("Co-Admin demoted.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handlePromoteToEmployee(userId: number) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/admin/users/${userId}/promote-employee`, { method: "POST" });
      setMessage("User promoted to Employee.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setCreatingTask(true);
    try {
      await apiFetch("/admin/tasks", {
        method: "POST",
        body: JSON.stringify({
          assignedToId: Number(taskAssignedToId),
          taskType,
          relatedUserId: taskRelatedUserId ? Number(taskRelatedUserId) : undefined,
          title: taskTitle,
          description: taskDescription || undefined,
        }),
      });
      setMessage("Task assigned.");
      setTaskAssignedToId("");
      setTaskRelatedUserId("");
      setTaskTitle("");
      setTaskDescription("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingTask(false);
    }
  }

  const employees = users.filter((u) => u.role === "employee");

  async function handleSetReferralReward(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings/referral-reward", {
        method: "POST",
        body: JSON.stringify({ amount: Number(referralReward) }),
      });
      setMessage("Referral reward updated.");
      setReferralReward("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadCoupons() {
    setLoadingCoupons(true);
    setCouponError("");
    try {
      const data = await apiFetch("/admin/coupons");
      setCoupons(data);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoadingCoupons(false);
    }
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError("");
    setCreatingCoupon(true);
    try {
      await apiFetch("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: couponCode,
          description: couponDescription || undefined,
          rewardType: couponRewardType,
          valueType: couponValueType,
          value: Number(couponValue),
          maxDiscount: couponMaxDiscount ? Number(couponMaxDiscount) : undefined,
          minOrderAmount: couponMinOrder ? Number(couponMinOrder) : undefined,
          usageLimit: couponUsageLimit ? Number(couponUsageLimit) : undefined,
          perUserLimit: couponPerUserLimit ? Number(couponPerUserLimit) : undefined,
          expiresAt: couponExpiresAt || undefined,
        }),
      });
      setCouponCode("");
      setCouponDescription("");
      setCouponValue("");
      setCouponMaxDiscount("");
      setCouponMinOrder("");
      setCouponUsageLimit("");
      setCouponPerUserLimit("1");
      setCouponExpiresAt("");
      await loadCoupons();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingCoupon(false);
    }
  }

  async function handleToggleCoupon(couponId: number) {
    setCouponError("");
    try {
      await apiFetch(`/admin/coupons/${couponId}/toggle`, { method: "POST" });
      await loadCoupons();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadRiskFlags() {
    setLoadingRiskFlags(true);
    setRiskError("");
    try {
      const data = await apiFetch("/admin/risk-flags");
      setRiskFlags(data);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Failed to load risk flags");
    } finally {
      setLoadingRiskFlags(false);
    }
  }

  async function handleResolveRiskFlag(flagId: number) {
    setRiskError("");
    try {
      await apiFetch(`/admin/risk-flags/${flagId}/resolve`, { method: "POST" });
      await loadRiskFlags();
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadDataRequests() {
    setLoadingDataRequests(true);
    setDataRequestsError("");
    try {
      const data = await apiFetch("/admin/data-requests");
      setDataRequests(data);
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Failed to load data requests");
    } finally {
      setLoadingDataRequests(false);
    }
  }

  async function handleCompleteDataRequest(requestId: number) {
    setDataRequestsError("");
    try {
      await apiFetch(`/admin/data-requests/${requestId}/complete`, { method: "POST" });
      await loadDataRequests();
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleRejectDataRequest(requestId: number) {
    setDataRequestsError("");
    try {
      await apiFetch(`/admin/data-requests/${requestId}/reject`, { method: "POST" });
      await loadDataRequests();
    } catch (err) {
      setDataRequestsError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function loadStores() {
    setLoadingStores(true);
    setStoresError("");
    try {
      const data = await apiFetch("/admin/stores");
      setStores(data);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }

  async function handleToggleStoreActive(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/admin/stores/${storeId}/toggle-active`, { method: "POST" });
      await loadStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleTogglePrintService(storeId: number) {
    setStoresError("");
    try {
      await apiFetch(`/admin/stores/${storeId}/toggle-print-service`, { method: "POST" });
      await loadStores();
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Admin dashboard</h1>

        {earnings && (
          <div className="glass-panel hud-border mt-6 p-6 hud-scanline">
            <p className="font-body text-sm text-rv-text-dim">Platform earnings (this month)</p>
            <p className="mt-1 font-display text-3xl font-semibold text-rv-cyan">
              ₹{earnings.totalEarnings}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(earnings.breakdownByType).map(([type, amount]) => (
                <span key={type} className="rounded-full border border-rv-border px-3 py-1 font-body text-xs text-rv-text-dim">
                  {type.replace(/_/g, " ")}: ₹{amount}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {(["users", "orders", "kyc", "tasks", "settings", "coupons", "risk", "privacy", "stores"] as const).map((t) => (
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

        {tab === "risk" && (
          <div className="mt-6 flex flex-col gap-2">
            {riskError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{riskError}</p>
            )}
            {loadingRiskFlags && <p className="font-body text-sm text-rv-text-dim">Loading risk flags...</p>}
            {!loadingRiskFlags && riskFlags.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No risk flags. Nothing suspicious detected yet.</p>
            )}
            {riskFlags.map((f) => (
              <div key={f.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">
                    {f.entityType} #{f.entityId} - {f.reason}
                  </p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Severity: <span className={f.severity === "high" ? "text-rv-danger" : "text-rv-cyan"}>{f.severity}</span>
                    {" - "}
                    {f.resolved ? "Resolved" : "Open"}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveRiskFlag(f.id)}
                  className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                >
                  {f.resolved ? "Reopen" : "Mark resolved"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "privacy" && (
          <div className="mt-6 flex flex-col gap-2">
            {dataRequestsError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{dataRequestsError}</p>
            )}
            {loadingDataRequests && <p className="font-body text-sm text-rv-text-dim">Loading data requests...</p>}
            {!loadingDataRequests && dataRequests.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No data requests yet.</p>
            )}
            {dataRequests.map((r) => (
              <div key={r.id} className="glass-panel flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-body text-sm text-rv-text">
                    User #{r.userId} - {r.type}
                    {r.notes ? ` - "${r.notes}"` : ""}
                  </p>
                  <p className="font-body text-xs text-rv-text-dim">
                    Requested {new Date(r.requestedAt).toLocaleString()}
                    {" - "}
                    <span
                      className={
                        r.status === "completed"
                          ? "text-rv-cyan"
                          : r.status === "rejected"
                          ? "text-rv-danger"
                          : "text-rv-text-dim"
                      }
                    >
                      {r.status}
                    </span>
                  </p>
                </div>
                {r.type === "deletion" && r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCompleteDataRequest(r.id)}
                      className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                    >
                      Approve &amp; anonymize
                    </button>
                    <button
                      onClick={() => handleRejectDataRequest(r.id)}
                      className="rounded-md border border-rv-danger/50 px-3 py-1.5 font-body text-sm text-rv-danger transition hover:bg-rv-danger/10"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "stores" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-2 font-body text-xs text-rv-text-dim">
              Toggle a store off to hide it from buyers entirely, or toggle off just its print service while keeping
              the store open.
            </p>
            {storesError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{storesError}</p>
            )}
            {loadingStores && <p className="font-body text-sm text-rv-text-dim">Loading stores...</p>}
            {!loadingStores && stores.length === 0 && (
              <p className="font-body text-sm text-rv-text-dim">No stores found.</p>
            )}
            {stores.map((s) => (
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

        {tab === "coupons" && (
          <div className="mt-6 flex flex-col gap-4">
            <form onSubmit={handleCreateCoupon} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">Create a coupon</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Code (e.g. WELCOME50)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="text"
                  value={couponDescription}
                  onChange={(e) => setCouponDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <select
                  value={couponRewardType}
                  onChange={(e) => setCouponRewardType(e.target.value as "discount" | "cashback")}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="discount">Discount (off order total)</option>
                  <option value="cashback">Cashback (credited to wallet)</option>
                </select>
                <select
                  value={couponValueType}
                  onChange={(e) => setCouponValueType(e.target.value as "flat" | "percent")}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="flat">Flat amount (Rs.)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  required
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                  placeholder="Value"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponMaxDiscount}
                  onChange={(e) => setCouponMaxDiscount(e.target.value)}
                  placeholder="Max discount (Rs., optional, for %)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponMinOrder}
                  onChange={(e) => setCouponMinOrder(e.target.value)}
                  placeholder="Minimum order amount (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponUsageLimit}
                  onChange={(e) => setCouponUsageLimit(e.target.value)}
                  placeholder="Total usage limit (optional)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={couponPerUserLimit}
                  onChange={(e) => setCouponPerUserLimit(e.target.value)}
                  placeholder="Per-user limit (default 1)"
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
              {couponError && (
                <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">{couponError}</p>
              )}
              <button
                type="submit"
                disabled={creatingCoupon}
                className="mt-4 rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {creatingCoupon ? "Creating..." : "Create coupon"}
              </button>
            </form>

            <div className="flex flex-col gap-2">
              {loadingCoupons && <p className="font-body text-sm text-rv-text-dim">Loading coupons...</p>}
              {!loadingCoupons && coupons.length === 0 && (
                <p className="font-body text-sm text-rv-text-dim">No coupons created yet.</p>
              )}
              {coupons.map((c) => (
                <div key={c.id} className="glass-panel flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-body text-sm text-rv-text">
                      {c.code} - {c.rewardType} - {c.valueType === "percent" ? `${c.value}%` : `Rs.${c.value}`}
                    </p>
                    <p className="font-body text-xs text-rv-text-dim">
                      Used {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} - {c.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleCoupon(c.id)}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {c.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="mt-6 flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.id} className="glass-panel px-5 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body text-sm text-rv-text">{u.name} · {u.email}</p>
                    <p className="font-body text-xs text-rv-text-dim">
                      {u.role} · KYC: {u.kycStatus}
                      {u.city && ` · ${u.city}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.role === "co_admin" ? (
                      <button
                        onClick={() => handleDemoteCoAdmin(u.id)}
                        className="rounded-md border border-rv-border px-3 py-1.5 font-body text-xs text-rv-text-dim transition hover:border-rv-danger hover:text-rv-danger"
                      >
                        Demote
                      </button>
                    ) : u.role === "employee" ? (
                      <span className="rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2.5 py-0.5 font-body text-xs text-rv-cyan">
                        Employee
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => setPromotingUserId(promotingUserId === u.id ? null : u.id)}
                          className="rounded-md border border-rv-cyan/40 px-3 py-1.5 font-body text-xs text-rv-cyan transition hover:hud-border"
                        >
                          {promotingUserId === u.id ? "Cancel" : "Make Co-Admin"}
                        </button>
                        <button
                          onClick={() => handlePromoteToEmployee(u.id)}
                          className="rounded-md border border-rv-magenta/40 px-3 py-1.5 font-body text-xs text-rv-magenta transition hover:bg-rv-magenta/10"
                        >
                          Make Employee
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {promotingUserId === u.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={promoteCity}
                      onChange={(e) => setPromoteCity(e.target.value)}
                      placeholder="City to assign (e.g. Mumbai)"
                      className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                    />
                    <button
                      onClick={() => handlePromoteToCoAdmin(u.id)}
                      disabled={!promoteCity}
                      className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 flex flex-col gap-2">
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
              <p className="font-body text-sm text-rv-text-dim">No pending KYC documents.</p>
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
                    {d.fileUrl && (
                      <button
                        onClick={() => handleViewFile(d.id)}
                        className="mt-1 inline-block font-body text-xs text-rv-cyan underline"
                      >
                        View file
                      </button>
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

        {tab === "tasks" && (
          <div className="mt-6">
            <form onSubmit={handleCreateTask} className="glass-panel p-6">
              <h2 className="font-display text-lg font-semibold text-rv-text">Assign a task</h2>
              {employees.length === 0 && (
                <p className="mt-2 font-body text-xs text-rv-text-dim">
                  No employees yet — promote a user to Employee from the Users tab first.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-3">
                <select
                  value={taskAssignedToId}
                  onChange={(e) => setTaskAssignedToId(e.target.value)}
                  required
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.email})
                    </option>
                  ))}
                </select>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={taskRelatedUserId}
                  onChange={(e) => setTaskRelatedUserId(e.target.value)}
                  placeholder="Related user ID (optional, e.g. the seller/delivery partner being verified)"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button
                  type="submit"
                  disabled={creatingTask || employees.length === 0}
                  className="rounded-md bg-rv-magenta px-4 py-2.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                >
                  {creatingTask ? "Assigning..." : "Assign task"}
                </button>
              </div>
            </form>

            <div className="mt-6 flex flex-col gap-2">
              <h2 className="font-display text-lg font-semibold text-rv-text">All tasks</h2>
              {tasks.length === 0 && (
                <p className="font-body text-sm text-rv-text-dim">No tasks yet.</p>
              )}
              {tasks.map((t) => {
                const assignee = users.find((u) => u.id === t.assignedToId);
                return (
                  <div key={t.id} className="glass-panel px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-body text-sm text-rv-text">{t.title}</p>
                        <p className="font-body text-xs text-rv-text-dim">
                          {t.taskType.replace(/_/g, " ")} · assigned to {assignee?.name ?? `#${t.assignedToId}`}
                        </p>
                        {t.notes && <p className="mt-1 font-body text-xs text-rv-cyan">Notes: {t.notes}</p>}
                      </div>
                      <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs capitalize text-rv-text-dim">
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="mt-6 flex flex-col gap-4">
            <form onSubmit={handleSetBookingFee} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">Booking fee (₹)</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="number"
                  min={0}
                  required
                  value={bookingFee}
                  onChange={(e) => setBookingFee(e.target.value)}
                  placeholder="e.g. 10"
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button type="submit" className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90">
                  Save
                </button>
              </div>
            </form>

            <form onSubmit={handleSetCommission} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">Commission (%)</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  placeholder="e.g. 5"
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button type="submit" className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90">
                  Save
                </button>
              </div>
            </form>

            <form onSubmit={handleSetGstRate} className="glass-panel p-6">
              <h2 className="font-display text-base font-semibold text-rv-text">GST rate by category</h2>
              <div className="mt-3 flex gap-3">
                <input
                  type="text"
                  required
                  value={gstCategory}
                  onChange={(e) => setGstCategory(e.target.value)}
                  placeholder="Category (e.g. clothing)"
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  required
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  placeholder="Rate %"
                  className="w-24 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button type="submit" className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90">
                  Save
                </button>
              </div>
            </form>

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