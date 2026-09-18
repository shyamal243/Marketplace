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
    <div className="hex-grid-bg flex min-h-screen items-center justify-center bg-rv-bg px-8 py-12">
      <div className="glass-panel w-full max-w-sm p-6 md:p-8">
        <h1 className="font-display text-2xl font-semibold text-rv-text">Forgot password</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Enter your email and we&apos;ll help you reset your password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
          />

          {error && (
            <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">{error}</p>
          )}
          {message && (
            <p className="rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-3 py-2 font-body text-sm text-rv-cyan">{message}</p>
          )}
          {devToken && (
            <div className="rounded-md border border-rv-border bg-rv-panel px-3 py-2">
              <p className="font-body text-xs text-rv-text-dim">
                (Dev mode — no email service configured yet. Your reset token:)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-rv-text">{devToken}</p>
              <Link href="/reset-password" className="mt-2 inline-block font-body text-xs text-rv-cyan underline">
                Go to reset page
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 font-body text-sm text-rv-text-dim">
          <Link href="/login" className="text-rv-cyan underline underline-offset-4">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}