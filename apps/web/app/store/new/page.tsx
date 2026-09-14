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
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Open a store</h1>
        <p className="mt-2 font-body text-sm text-indigo-border">
          Customers will find your products and can order directly.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-lg bg-paper p-6 md:p-8">
          <div>
            <label className="font-body text-sm font-medium text-ink">Store name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              placeholder="e.g. Ramesh Textiles"
            />
          </div>

          <div>
            <label className="font-body text-sm font-medium text-ink">
              Address <span className="text-ink/50">(optional)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              placeholder="Your store's address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-body text-sm font-medium text-ink">Base delivery fee</label>
              <input
                type="number"
                min={0}
                value={deliveryFeeBase}
                onChange={(e) => setDeliveryFeeBase(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-ink">Fee per km</label>
              <input
                type="number"
                min={0}
                value={deliveryFeePerKm}
                onChange={(e) => setDeliveryFeePerKm(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create store"}
          </button>
        </form>
      </div>
    </div>
  );
}
