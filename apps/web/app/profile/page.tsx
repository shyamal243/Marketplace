"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Me {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  address: string | null;
  referralCode: string | null;
  walletBalance: number;
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadMe();
  }, []);

  async function loadMe() {
    setLoading(true);
    try {
      const data = await apiFetch("/me");
      setMe(data);
      setName(data.name);
      setPhone(data.phone ?? "");
      setAddress(data.address ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSavingProfile(true);
    try {
      await apiFetch("/me/update", {
        method: "POST",
        body: JSON.stringify({ name, phone: phone || undefined, address: address || undefined }),
      });
      setMessage("Profile updated.");
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSavingPassword(true);
    try {
      await apiFetch("/me/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Your profile</h1>

        {me && (
          <div className="mt-6 rounded-lg bg-indigo-surface p-6">
            <p className="font-body text-sm text-indigo-border">{me.email} · {me.role}</p>
            <p className="mt-2 font-body text-sm text-indigo-border">
              Wallet balance: <span className="text-marigold">₹{me.walletBalance}</span>
            </p>
            {me.referralCode && (
              <p className="mt-2 font-body text-sm text-indigo-border">
                Your referral code: <span className="text-marigold">{me.referralCode}</span>
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        <form onSubmit={handleUpdateProfile} className="mt-6 rounded-lg bg-paper p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Edit details</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        <form onSubmit={handleChangePassword} className="mt-6 rounded-lg bg-paper p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
            >
              {savingPassword ? "Changing..." : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
