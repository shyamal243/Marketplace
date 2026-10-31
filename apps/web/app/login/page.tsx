"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import Header from "../Header";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-rv-bg via-rv-bg-alt to-rv-bg hex-grid-bg">
      <Header />

      <main className="relative flex flex-1 flex-col items-center justify-center px-8 py-16 md:px-16">
        <div className="relative w-full max-w-sm rounded-2xl border border-rv-border bg-rv-panel/70 px-8 py-10 shadow-hud-glow backdrop-blur-md">
          <Link
            href="/"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-rv-border font-body text-rv-text-dim transition hover:border-rv-cyan hover:text-rv-cyan"
          >
            âœ•
          </Link>

          <h2 className="text-center font-display text-3xl font-semibold text-rv-text">Login</h2>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
            <div>
              <label htmlFor="email" className="font-body text-xs uppercase tracking-wide text-rv-text-dim">
                Email
              </label>
              <div className="mt-1.5 flex items-center gap-2 border-b border-rv-border pb-1.5 focus-within:border-rv-cyan">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent font-body text-rv-text outline-none"
                  placeholder="you@example.com"
                />
                <span className="font-body text-rv-text-dim">âœ‰</span>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="font-body text-xs uppercase tracking-wide text-rv-text-dim">
                Password
              </label>
              <div className="mt-1.5 flex items-center gap-2 border-b border-rv-border pb-1.5 focus-within:border-rv-cyan">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent font-body text-rv-text outline-none"
                  placeholder="Your password"
                />
                <span className="font-body text-rv-text-dim">ðŸ”’</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-body text-xs text-rv-text-dim">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-rv-border accent-rv-cyan"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="font-body text-xs text-rv-text-dim underline underline-offset-4 hover:text-rv-cyan">
                Forgot password?
              </Link>
            </div>

            {error && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-rv-text px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <p className="text-center font-body text-xs text-rv-text-dim">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-rv-cyan underline underline-offset-4">
                Register
              </Link>
            </p>
          </form>
        </div>
      </main>

    </div>
  );
}