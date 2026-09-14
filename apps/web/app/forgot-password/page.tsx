"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await apiFetch("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      if (data.resetToken) {
        setDevToken(data.resetToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-indigo-deep px-8 py-12">
      <div className="w-full max-w-sm rounded-lg bg-paper p-6 md:p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Forgot password</h1>
        <p className="mt-2 font-body text-sm text-ink/70">
          Enter your email and we&apos;ll help you reset your password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">{error}</p>
          )}
          {message && (
            <p className="rounded-md bg-marigold/10 px-3 py-2 font-body text-sm text-marigold">{message}</p>
          )}
          {devToken && (
            <div className="rounded-md border border-ink/15 bg-white px-3 py-2">
              <p className="font-body text-xs text-ink/60">
                (Dev mode — no email service configured yet. Your reset token:)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-ink">{devToken}</p>
              <Link href="/reset-password" className="mt-2 inline-block font-body text-xs text-marigold underline">
                Go to reset page
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
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
