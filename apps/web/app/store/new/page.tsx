"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function NewStorePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFeeBase, setDeliveryFeeBase] = useState("20");
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState("5");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const store = await apiFetch("/stores", {
        method: "POST",
        body: JSON.stringify({
          name,
          address: address || undefined,
          deliveryFeeBase: Number(deliveryFeeBase),
          deliveryFeePerKm: Number(deliveryFeePerKm),
        }),
      });

      router.push(`/stores/${store.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Open a store</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Customers will find your products and can order directly.
        </p>

        <form onSubmit={handleSubmit} className="glass-panel mt-8 flex flex-col gap-5 p-6 md:p-8">
          <div>
            <label className="font-body text-sm font-medium text-rv-text">Store name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              placeholder="e.g. Ramesh Textiles"
            />
          </div>

          <div>
            <label className="font-body text-sm font-medium text-rv-text">
              Address <span className="text-rv-text-dim">(optional)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              placeholder="Your store's address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-body text-sm font-medium text-rv-text">Base delivery fee</label>
              <input
                type="number"
                min={0}
                value={deliveryFeeBase}
                onChange={(e) => setDeliveryFeeBase(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-rv-text">Fee per km</label>
              <input
                type="number"
                min={0}
                value={deliveryFeePerKm}
                onChange={(e) => setDeliveryFeePerKm(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create store"}
          </button>
        </form>
      </div>
    </div>
  );
}