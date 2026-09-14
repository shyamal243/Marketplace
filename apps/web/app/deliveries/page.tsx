"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface DeliveryAssignment {
  id: number;
  orderId: number;
  status: string;
  distanceKm: number | null;
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

  async function handleAdvance(assignment: DeliveryAssignment) {
    const nextStatus = STATUS_FLOW[assignment.status];
    if (!nextStatus) return;

    setUpdating(assignment.id);
    setError("");
    try {
      await apiFetch(`/deliveries/${assignment.orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Your deliveries</h1>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && assignments.length === 0 && (
          <p className="mt-8 font-body text-indigo-border">No deliveries assigned to you right now.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-lg bg-indigo-surface p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-paper">Order #{a.orderId}</span>
                <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              {a.distanceKm !== null && (
                <p className="mt-1 font-body text-xs text-indigo-border">{a.distanceKm.toFixed(1)} km</p>
              )}
              {STATUS_FLOW[a.status] && (
                <button
                  onClick={() => handleAdvance(a)}
                  disabled={updating === a.id}
                  className="mt-4 w-full rounded-md bg-marigold px-4 py-2 font-body text-sm font-medium text-indigo-deep transition hover:opacity-90 disabled:opacity-60"
                >
                  {updating === a.id ? "Updating..." : STATUS_LABEL[a.status]}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
