"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

interface Order {
  id: number;
  amount: number;
  status: string;
  isPaid: boolean;
  buyerId: number;
  sellerId: number;
  orderType: string;
  otpRequired?: boolean;
  checkoutOtpVerifiedAt?: string | null;
  deliveryOtpVerifiedAt?: string | null;
  scheduleType?: string | null;
  scheduledFor?: string | null;
  hoursBooked?: number | null;
}

interface Tracking {
  deliveryMode: string | null;
  orderStatus: string;
  deliveryStatus?: string | null;
  courierName?: string;
  trackingNumber?: string;
}

interface ReturnRequest {
  id: number;
  status: string;
  reason: string;
}

interface User {
  id: number;
  role: string;
}

const RETURN_REASONS = [
  "Item damaged or defective",
  "Item not as described",
  "Wrong item received",
  "No longer needed",
  "Found a better price elsewhere",
  "Other",
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("courier");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [tipAmount, setTipAmount] = useState("");
  const [deliveryRating, setDeliveryRating] = useState(5);

  const [checkoutOtpInput, setCheckoutOtpInput] = useState("");
  const [deliveryOtpInput, setDeliveryOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");

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

      if (found && (found.status === "shipped" || found.status === "delivered")) {
        try {
          const trackingData = await apiFetch(`/orders/${id}/tracking`);
          setTracking(trackingData);
        } catch {
          setTracking(null);
        }
      }

      try {
        const rr = await apiFetch(`/orders/${id}/return`);
        setReturnRequest(rr);
      } catch {
        setReturnRequest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCheckoutOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    setActionLoading(true);
    try {
      await apiFetch(`/orders/${id}/verify-checkout-otp`, {
        method: "POST",
        body: JSON.stringify({ otp: checkoutOtpInput }),
      });
      setCheckoutOtpInput("");
      setMessage("Checkout verified! The seller can now ship your order.");
      await loadOrder();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Incorrect OTP");
    } finally {
      setActionLoading(false);
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
          ? { deliveryMode: "local" }
          : { deliveryMode: "courier", trackingNumber, courierName };

      const result = await apiFetch(`/orders/${id}/ship`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(
        result.assignedTo
          ? `Shipped! Auto-assigned to ${result.assignedTo}.`
          : "Marked as shipped."
      );
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
    setOtpError("");
    setMessage("");
    try {
      await apiFetch(`/orders/${id}/deliver`, {
        method: "POST",
        body: JSON.stringify(order?.otpRequired ? { otp: deliveryOtpInput } : {}),
      });
      setMessage("Marked as delivered.");
      setDeliveryOtpInput("");
      await loadOrder();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (order?.otpRequired) {
        setOtpError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteService() {
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/orders/${id}/complete`, { method: "POST" });
      setMessage("Booking marked as completed.");
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

  async function handleReturnRequest(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/orders/${id}/return`, {
        method: "POST",
        body: JSON.stringify({ reason: returnReason }),
      });
      setMessage("Return requested. The seller will review it.");
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTip(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/deliveries/${id}/tip`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(tipAmount) }),
      });
      setMessage("Tip sent!");
      setTipAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeliveryRating(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/deliveries/${id}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating: deliveryRating }),
      });
      setMessage("Delivery rated, thanks!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  if (!order) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Order not found.</div>;
  }

  const isBuyer = user?.id === order.buyerId;
  const isSeller = user?.id === order.sellerId;
  const isServiceBooking = order.orderType === "service_booking";
  const needsCheckoutOtp = isBuyer && order.otpRequired && !order.checkoutOtpVerifiedAt;
  const needsDeliveryOtp = isBuyer && order.otpRequired && !order.deliveryOtpVerifiedAt;
  const canReview = isBuyer && (order.status === "delivered" || order.status === "completed");

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <div className="glass-panel p-6 md:p-8">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-semibold text-rv-magenta">₹{order.amount}</span>
            <span className="rounded-full border border-rv-border px-3 py-1 font-body text-xs text-rv-text-dim">
              {order.status}
            </span>
          </div>
          <p className="mt-2 font-body text-sm text-rv-text-dim">
            Order #{order.id} · {order.isPaid ? "Paid" : "Payment pending"}
          </p>
          <Link href={`/orders/${order.id}/invoice`} className="mt-1 inline-block font-body text-xs text-rv-cyan underline">
            View invoice
          </Link>

          {isServiceBooking && (
            <div className="mt-3 rounded-md border border-rv-border bg-rv-panel px-4 py-3">
              <p className="font-body text-xs uppercase tracking-wide text-rv-text-dim">Booking details</p>
              <p className="mt-1 font-body text-sm capitalize text-rv-text">
                {order.scheduleType} · {order.hoursBooked}h
              </p>
              {order.scheduledFor && (
                <p className="mt-1 font-body text-xs text-rv-text-dim">
                  {new Date(order.scheduledFor).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {order.otpRequired && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rv-magenta/40 bg-rv-magenta/10 px-3 py-1">
              <span className="font-body text-xs text-rv-magenta">💎 Jewellery — OTP verification required</span>
            </div>
          )}

          {tracking && (
            <div className="mt-4 rounded-md border border-rv-border bg-rv-panel px-4 py-3">
              <p className="font-body text-xs uppercase tracking-wide text-rv-text-dim">Tracking</p>
              {tracking.deliveryMode === "courier" && (
                <p className="mt-1 font-body text-sm text-rv-text">
                  {tracking.courierName} · {tracking.trackingNumber}
                </p>
              )}
              {tracking.deliveryMode === "local" && (
                <p className="mt-1 font-body text-sm text-rv-text capitalize">
                  {tracking.deliveryStatus?.replace(/_/g, " ")}
                </p>
              )}
            </div>
          )}

          {returnRequest && (
            <div className="mt-4 rounded-md border border-rv-cyan/30 bg-rv-cyan/10 px-4 py-3">
              <p className="font-body text-xs uppercase tracking-wide text-rv-cyan">Return status</p>
              <p className="mt-1 font-body text-sm text-rv-text capitalize">
                {returnRequest.status} · {returnRequest.reason}
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        {needsCheckoutOtp && (
          <form onSubmit={handleVerifyCheckoutOtp} className="hud-border glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-magenta">💎 Verify checkout OTP</h2>
            <p className="mt-1 font-body text-sm text-rv-text-dim">
              This is a high-value jewellery order. Enter the 6-digit code shown when you checked out to let the seller ship it.
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                required
                maxLength={6}
                value={checkoutOtpInput}
                onChange={(e) => setCheckoutOtpInput(e.target.value)}
                placeholder="6-digit code"
                className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text tracking-widest outline-none focus:border-rv-magenta focus:shadow-hud-glow-magenta"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {actionLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
            {otpError && (
              <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">{otpError}</p>
            )}
          </form>
        )}

        {isSeller && isServiceBooking && order.status === "confirmed" && (
          <button
            onClick={handleCompleteService}
            disabled={actionLoading}
            className="mt-6 w-full rounded-md bg-rv-cyan px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading ? "Marking complete..." : "Mark booking as complete"}
          </button>
        )}

        {isSeller && !isServiceBooking && order.status === "confirmed" && (
          <form onSubmit={handleShip} className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Ship this order</h2>
            {order.otpRequired && !order.checkoutOtpVerifiedAt && (
              <p className="mt-1 font-body text-xs text-rv-magenta">
                Waiting on the buyer to verify their checkout OTP before this can be shipped.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("local")}
                className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                  deliveryMode === "local"
                    ? "border-rv-cyan bg-rv-cyan/10 text-rv-text shadow-hud-glow"
                    : "border-rv-border bg-rv-panel text-rv-text-dim hover:border-rv-cyan/40"
                }`}
              >
                Local delivery
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("courier")}
                className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                  deliveryMode === "courier"
                    ? "border-rv-cyan bg-rv-cyan/10 text-rv-text shadow-hud-glow"
                    : "border-rv-border bg-rv-panel text-rv-text-dim hover:border-rv-cyan/40"
                }`}
              >
                Courier
              </button>
            </div>

            {deliveryMode === "local" ? (
              <p className="mt-4 font-body text-xs text-rv-text-dim">
                A nearby available delivery partner will be auto-assigned when you confirm.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <input
                  type="text"
                  required
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="Courier name (e.g. Delhivery)"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Tracking number"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={actionLoading}
              className="mt-4 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {actionLoading ? "Shipping..." : "Confirm shipment"}
            </button>
          </form>
        )}

        {isBuyer && order.status === "shipped" && (
          <div className="mt-6">
            {needsDeliveryOtp && (
              <div className="hud-border glass-panel mb-3 p-4">
                <p className="font-body text-sm text-rv-magenta">
                  💎 Check your notifications for the delivery verification code, then enter it below to confirm you received your item.
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={deliveryOtpInput}
                  onChange={(e) => setDeliveryOtpInput(e.target.value)}
                  placeholder="6-digit code"
                  className="mt-3 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text tracking-widest outline-none focus:border-rv-magenta focus:shadow-hud-glow-magenta"
                />
                {otpError && (
                  <p className="mt-2 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">{otpError}</p>
                )}
              </div>
            )}
            <button
              onClick={handleDeliver}
              disabled={actionLoading}
              className="w-full rounded-md bg-rv-cyan px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
            >
              {actionLoading ? "Confirming..." : "Confirm delivery"}
            </button>
          </div>
        )}

        {canReview && (
          <>
            <form onSubmit={handleReview} className="glass-panel mt-6 p-6">
              <h2 className="font-display text-lg font-semibold text-rv-text">Leave a review</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`text-2xl ${n <= rating ? "text-rv-magenta" : "text-rv-text-dim/30"}`}
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
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                >
                  Submit review
                </button>
              </div>
            </form>

            {!isServiceBooking && (
              <form onSubmit={handleDeliveryRating} className="glass-panel mt-4 p-6">
                <h2 className="font-display text-lg font-semibold text-rv-text">Rate the delivery</h2>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDeliveryRating(n)}
                        className={`text-2xl ${n <= deliveryRating ? "text-rv-magenta" : "text-rv-text-dim/30"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                  >
                    Rate
                  </button>
                </div>
              </form>
            )}

            {!isServiceBooking && (
              <form onSubmit={handleTip} className="glass-panel mt-4 p-6">
                <h2 className="font-display text-lg font-semibold text-rv-text">Tip the delivery person</h2>
                <div className="mt-4 flex gap-3">
                  <input
                    type="number"
                    min={1}
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="Amount (₹)"
                    className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                  >
                    Send tip
                  </button>
                </div>
              </form>
            )}

            {!isServiceBooking && !returnRequest && (
              <form onSubmit={handleReturnRequest} className="glass-panel mt-4 p-6">
                <h2 className="font-display text-lg font-semibold text-rv-text">Return or replace item</h2>
                <div className="mt-4 flex flex-col gap-3">
                  <label className="font-body text-sm text-rv-text-dim">Reason for return</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                  >
                    {RETURN_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-md border border-rv-border px-4 py-2 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                  >
                    {actionLoading ? "Submitting..." : "Submit return request"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}