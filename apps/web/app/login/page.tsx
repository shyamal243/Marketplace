"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";

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
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-between bg-indigo-deep px-8 py-12 md:px-16 md:py-20">
        <div>
          <span className="inline-block h-2 w-2 rounded-full bg-marigold" />
          <span className="ml-2 font-body text-sm text-indigo-border">Reverse marketplace</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-paper md:text-5xl">
            Post what you need.
            <br />
            Let sellers come to you.
          </h1>
          <p className="mt-6 font-body text-base leading-relaxed text-indigo-border">
            Skip the endless searching. Describe what you're looking for, and
            watch offers come in from sellers, workers, and delivery partners
            ready to help.
          </p>
        </div>
        <p className="font-body text-sm text-indigo-border">
          New here?{" "}
          <Link href="/signup" className="text-marigold underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>

      <div className="flex items-center justify-center bg-paper px-8 py-12 md:px-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-semibold text-ink">Welcome back</h2>
          <p className="mt-2 font-body text-sm text-ink/70">
            Log in to check your demands, bids, and orders.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="font-body text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="font-body text-sm font-medium text-ink">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                placeholder="Your password"
              />
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
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
