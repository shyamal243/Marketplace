$path = "apps\web\app\login\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$newContent = @'
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import Footer from "../Footer";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="flex min-h-screen flex-col bg-rv-bg hex-grid-bg">
      <header className="flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
        <Link href="/" className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
          DEMAND//BOARD
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 py-12 md:px-16">
        <div className="glass-panel w-full max-w-sm px-8 py-10">
          <h2 className="font-display text-3xl font-semibold text-rv-text">Welcome back</h2>
          <p className="mt-2 font-body text-sm text-rv-text-dim">
            Log in to check your demands, bids, and orders.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="font-body text-sm font-medium text-rv-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="font-body text-sm font-medium text-rv-text">
                  Password
                </label>
                <Link href="/forgot-password" className="font-body text-xs text-rv-text-dim underline underline-offset-4 hover:text-rv-cyan">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="Your password"
              />
            </div>

            {error && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-6 font-body text-sm text-rv-text-dim">
          New here?{" "}
          <Link href="/signup" className="text-rv-cyan underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $newContent, $utf8NoBom)
Write-Host "Rewrote $path" -ForegroundColor Green
