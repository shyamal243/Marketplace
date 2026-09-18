"use client";

import { useState } from "react";
import { apiFetch } from "../lib/api";

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface Profile {
  user: { id: number; name: string; role: string };
  averageRating: number | null;
  totalReviews: number;
  completedOrders: number;
}

export default function ReviewsPage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const [profileData, reviewsData] = await Promise.all([
        apiFetch(`/users/${userId}/profile`),
        apiFetch(`/users/${userId}/reviews`),
      ]);
      setProfile(profileData);
      setReviews(reviewsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Reviews &amp; ratings</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Look up a seller or worker&apos;s reputation before you deal with them.
        </p>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            type="number"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
            className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Looking up..." : "Look up"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}

        {profile && (
          <div className="glass-panel mt-6 p-6">
            <p className="font-body text-lg text-rv-text">{profile.user.name}</p>
            <p className="font-body text-xs text-rv-text-dim">{profile.user.role}</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="font-display text-2xl font-semibold text-rv-magenta">
                {profile.averageRating !== null ? profile.averageRating.toFixed(1) : "—"} ★
              </span>
              <span className="font-body text-xs text-rv-text-dim">
                {profile.totalReviews} reviews · {profile.completedOrders} completed orders
              </span>
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="glass-panel p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-semibold text-rv-magenta">
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </span>
                  <span className="font-body text-xs text-rv-text-dim">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && <p className="mt-2 font-body text-sm text-rv-text-dim">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}