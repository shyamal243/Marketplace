"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface DeliveryAssignment {
  id: number;
  orderId: number;
  status: string;
  distanceKm: number | null;
  orderType?: string | null;
}

const STATUS_FLOW: Record<string, string> = {
  assigned: "picked_up",
  picked_up: "out_for_delivery",
  out_for_delivery: "delivered",
};

const STATUS_LABEL: Record<string, string> = {
  assigned: "Mark as picked up",
  picked_up: "Mark as out for delivery",
  out_for_delivery: "Mark as delivered",
};

export default function DeliveriesPage() {
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    setLoading(true);
    try {
      const data = await apiFetch("/deliveries/mine");
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAvailability() {
    setTogglingAvailability(true);
    setError("");

    const goingAvailable = !isAvailable;

    if (goingAvailable && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await apiFetch("/me/availability", {
              method: "POST",
              body: JSON.stringify({
                isAvailable: true,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            });
            setIsAvailable(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
          } finally {
            setTogglingAvailability(false);
          }
        },
        async () => {
          try {
            await apiFetch("/me/availability", {
              method: "POST",
              body: JSON.stringify({ isAvailable: true }),
            });
            setIsAvailable(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
          } finally {
            setTogglingAvailability(false);
          }
        }
      );
    } else {
      try {
        await apiFetch("/me/availability", {
          method: "POST",
          body: JSON.stringify({ isAvailable: false }),
        });
        setIsAvailable(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setTogglingAvailability(false);
      }
    }
  }

  async function handleAdvance(assignment: DeliveryAssignment) {
    const nextStatus = STATUS_FLOW[assignment.status];
    if (!nextStatus) return;

    const needsStartOtp =
      (assignment.orderType === "logistics_booking" || assignment.orderType === "vehicle_rental") &&
      nextStatus === "picked_up";
    const needsEndOtp = assignment.orderType === "vehicle_rental" && nextStatus === "delivered";
    const needsOtp = needsStartOtp || needsEndOtp;

    const otp = otpInputs[assignment.id] ?? "";

    if (needsOtp && !otp) {
      setError(
        needsEndOtp ? "Enter the rider's return code first." : "Enter the rider's start code first."
      );
      return;
    }

    setUpdating(assignment.id);
    setError("");
    try {
      await apiFetch(`/deliveries/${assignment.orderId}/status`, {
        method: "POST",
        body: JSON.stringify(needsOtp ? { status: nextStatus, otp } : { status: nextStatus }),
      });
      setOtpInputs((prev) => {
        const next = { ...prev };
        delete next[assignment.id];
        return next;
      });
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-rv-text">Your deliveries</h1>
          <button
            onClick={handleToggleAvailability}
            disabled={togglingAvailability}
            className={`rounded-md px-4 py-2 font-body text-sm font-medium transition disabled:opacity-60 ${
              isAvailable
                ? "bg-rv-cyan text-rv-bg shadow-hud-glow animate-hud-pulse"
                : "border border-rv-border text-rv-text hover:hud-border hover:text-rv-cyan"
            }`}
          >
            {togglingAvailability ? "..." : isAvailable ? "Available" : "Go available"}
          </button>
        </div>
        <p className="mt-1 font-body text-xs text-rv-text-dim">
          {isAvailable
            ? "You're visible for local delivery auto-assignment."
            : "Toggle on to start receiving auto-assigned deliveries."}
        </p>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {!loading && !error && assignments.length === 0 && (
          <p className="mt-8 font-body text-rv-text-dim">No deliveries assigned to you right now.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {assignments.map((a) => {
            const nextStatus = STATUS_FLOW[a.status];
            const needsStartOtp =
              (a.orderType === "logistics_booking" || a.orderType === "vehicle_rental") &&
              nextStatus === "picked_up";
            const needsEndOtp = a.orderType === "vehicle_rental" && nextStatus === "delivered";
            const needsOtp = needsStartOtp || needsEndOtp;

            const label =
              a.orderType === "vehicle_rental" ? "Rental" : a.orderType === "logistics_booking" ? "Ride" : "Order";

            return (
              <div key={a.id} className="glass-panel p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-semibold text-rv-text">
                    {label} #{a.orderId}
                  </span>
                  <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs text-rv-text-dim">
                    {a.status.replace(/_/g, " ")}
                  </span>
                </div>
                {a.distanceKm !== null && (
                  <p className="mt-1 font-body text-xs text-rv-text-dim">{a.distanceKm.toFixed(1)} km</p>
                )}

                {needsOtp && (
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInputs[a.id] ?? ""}
                    onChange={(e) => setOtpInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder={needsEndOtp ? "Rider's return code" : "Rider's start code"}
                    className="mt-3 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text tracking-widest outline-none focus:border-rv-magenta focus:shadow-hud-glow-magenta"
                  />
                )}

                {nextStatus && (
                  <button
                    onClick={() => handleAdvance(a)}
                    disabled={updating === a.id}
                    className="mt-4 w-full rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                  >
                    {updating === a.id ? "Updating..." : STATUS_LABEL[a.status]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}