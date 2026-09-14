"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await apiFetch("/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage("Password reset successfully. Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-indigo-deep px-8 py-12">
      <div className="w-full max-w-sm rounded-lg bg-paper p-6 md:p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Reset password</h1>
        <p className="mt-2 font-body text-sm text-ink/70">
          Paste the reset token you received and choose a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Reset token"
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

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">{error}</p>
          )}
          {message && (
            <p className="rounded-md bg-marigold/10 px-3 py-2 font-body text-sm text-marigold">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <p className="mt-6 font-body text-sm text-ink/70">
          <Link href="/login" className="text-marigold underline underline-offset-4">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
