"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

const DURATIONS = [1, 2, 3, 6, 12, 24];

export default function NewDemandPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("");
  const [durationHours, setDurationHours] = useState(2);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const demand = await apiFetch("/demands", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          budget: budget ? Number(budget) : undefined,
          category: category || undefined,
          durationHours,
        }),
      });

      router.push(`/demands/${demand.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Post a demand</h1>
        <p className="mt-2 font-body text-sm text-indigo-border">
          Describe what you need. A ₹10 booking fee applies once you post —
          refunded automatically if no one bids.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-lg bg-paper p-6 md:p-8">
          <div>
            <label htmlFor="title" className="font-body text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              placeholder="e.g. Need 500 cotton t-shirts"
            />
          </div>

          <div>
            <label htmlFor="description" className="font-body text-sm font-medium text-ink">
              Description <span className="text-ink/50">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              placeholder="Any details sellers should know"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="budget" className="font-body text-sm font-medium text-ink">
                Budget <span className="text-ink/50">(optional)</span>
              </label>
              <input
                id="budget"
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                placeholder="₹"
              />
            </div>

            <div>
              <label htmlFor="category" className="font-body text-sm font-medium text-ink">
                Category <span className="text-ink/50">(optional)</span>
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                placeholder="e.g. clothing, cleaning, maid"
              />
            </div>
          </div>

          <div>
            <span className="font-body text-sm font-medium text-ink">Bidding window</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {DURATIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                    durationHours === h
                      ? "border-marigold bg-marigold/10 text-ink"
                      : "border-ink/15 bg-white text-ink/70 hover:border-ink/30"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
          >
            {loading ? "Posting..." : "Post demand"}
          </button>
        </form>
      </div>
    </div>
  );
}
