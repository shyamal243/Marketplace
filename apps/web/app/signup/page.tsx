"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, trackEvent } from "../lib/api";

const ROLES = [
  { value: "buyer", label: "Buyer", blurb: "Post what you need" },
  { value: "seller", label: "Seller", blurb: "Bid on demands, run a store" },
  { value: "professional", label: "Professional", blurb: "Offer hourly services" },
  { value: "delivery", label: "Delivery", blurb: "Handle local deliveries" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/signup", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          referralCode: referralCode || undefined,
        }),
      });

      const loginData = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", loginData.token);
      localStorage.setItem("user", JSON.stringify(loginData.user));
      trackEvent("sign_up", { role });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hex-grid-bg flex flex-col justify-between bg-rv-bg px-8 py-12 md:px-16 md:py-20">
        <div>
          <span className="inline-block h-2 w-2 rounded-full bg-rv-magenta shadow-hud-glow-magenta animate-hud-pulse" />
          <span className="ml-2 font-body text-sm text-rv-text-dim">Reverse marketplace</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-rv-text md:text-5xl">
            Every role has
            <br />
            a place here.
          </h1>
          <p className="mt-6 font-body text-base leading-relaxed text-rv-text-dim">
            Buyers post demands. Sellers and professionals bid. Delivery partners
            handle the last mile. Pick where you fit in.
          </p>
        </div>
        <p className="font-body text-sm text-rv-text-dim">
          Already have an account?{" "}
          <Link href="/login" className="text-rv-cyan underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>

      <div className="flex items-center justify-center bg-rv-bg-alt px-8 py-12 md:px-16">
        <div className="glass-panel w-full max-w-sm px-8 py-10">
          <h2 className="font-display text-3xl font-semibold text-rv-text">Create your account</h2>
          <p className="mt-2 font-body text-sm text-rv-text-dim">
            Takes less than a minute.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="name" className="font-body text-sm font-medium text-rv-text">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="Your name"
              />
            </div>

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
              <label htmlFor="password" className="font-body text-sm font-medium text-rv-text">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <span className="font-body text-sm font-medium text-rv-text">I am a</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`rounded-md border px-3 py-2 text-left font-body transition ${
                      role === r.value
                        ? "border-rv-cyan bg-rv-cyan/10 shadow-hud-glow"
                        : "border-rv-border bg-rv-panel hover:border-rv-cyan/40"
                    }`}
                  >
                    <div className="text-sm font-medium text-rv-text">{r.label}</div>
                    <div className="text-xs text-rv-text-dim">{r.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="referralCode" className="font-body text-sm font-medium text-rv-text">
                Referral code <span className="text-rv-text-dim">(optional)</span>
              </label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="Got a code from a friend?"
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}