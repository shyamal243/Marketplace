$dir = "apps\web\app\account\privacy"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$pagePath = Join-Path $dir "page.tsx"

$pageContent = @'
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

interface DataRequestRecord {
  id: number;
  type: string;
  status: string;
  notes: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export default function MyPrivacyPage() {
  const [requests, setRequests] = useState<DataRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [deletionReason, setDeletionReason] = useState("");
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [deletionSuccess, setDeletionSuccess] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/data-requests/me");
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const data = await apiFetch("/data-requests/export", { method: "POST" });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      await loadRequests();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export your data");
    } finally {
      setExporting(false);
    }
  }

  async function handleRequestDeletion() {
    setRequestingDeletion(true);
    setDeletionError("");
    setDeletionSuccess("");
    try {
      await apiFetch("/data-requests/deletion", {
        method: "POST",
        body: JSON.stringify({ reason: deletionReason }),
      });
      setDeletionSuccess("Your deletion request has been submitted. Our team will review it shortly.");
      setDeletionReason("");
      await loadRequests();
    } catch (err) {
      setDeletionError(err instanceof Error ? err.message : "Could not submit your deletion request");
    } finally {
      setRequestingDeletion(false);
    }
  }

  const hasPendingDeletion = requests.some((r) => r.type === "deletion" && r.status === "pending");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 md:px-0">
      <div>
        <h1 className="font-body text-2xl font-semibold text-rv-text">My Privacy</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Manage your personal data. You can export a copy of everything we hold about you, or request that your
          account be deleted.
        </p>
      </div>

      <section className="glass-panel flex flex-col gap-3 px-6 py-5">
        <h2 className="font-body text-lg font-semibold text-rv-text">Export your data</h2>
        <p className="font-body text-sm text-rv-text-dim">
          Download a JSON file containing your profile, orders, reviews, wallet transactions, and stores (if you're a
          seller).
        </p>
        {exportError && (
          <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">
            {exportError}
          </p>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="self-start rounded-md border border-rv-border px-4 py-2 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan disabled:opacity-50"
        >
          {exporting ? "Preparing export..." : "Download my data"}
        </button>
      </section>

      <section className="glass-panel flex flex-col gap-3 px-6 py-5">
        <h2 className="font-body text-lg font-semibold text-rv-text">Delete my account</h2>
        <p className="font-body text-sm text-rv-text-dim">
          This will anonymize your personal information (name, email, phone, address). Your past orders and financial
          records will be kept for legal and audit purposes, but will no longer be linked to your identity. Our team
          reviews every request before it&apos;s processed.
        </p>
        {deletionError && (
          <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">
            {deletionError}
          </p>
        )}
        {deletionSuccess && (
          <p className="rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-2 font-body text-sm text-rv-cyan">
            {deletionSuccess}
          </p>
        )}
        {hasPendingDeletion ? (
          <p className="font-body text-sm text-rv-text-dim">You already have a deletion request pending review.</p>
        ) : (
          <>
            <textarea
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Optional: let us know why you're leaving"
              className="rounded-md border border-rv-border bg-transparent px-3 py-2 font-body text-sm text-rv-text placeholder:text-rv-text-dim"
              rows={3}
            />
            <button
              onClick={handleRequestDeletion}
              disabled={requestingDeletion}
              className="self-start rounded-md border border-rv-danger/50 px-4 py-2 font-body text-sm text-rv-danger transition hover:bg-rv-danger/10 disabled:opacity-50"
            >
              {requestingDeletion ? "Submitting..." : "Request account deletion"}
            </button>
          </>
        )}
      </section>

      <section className="glass-panel flex flex-col gap-2 px-6 py-5">
        <h2 className="font-body text-lg font-semibold text-rv-text">Your requests</h2>
        {error && (
          <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-2 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}
        {loading && <p className="font-body text-sm text-rv-text-dim">Loading...</p>}
        {!loading && requests.length === 0 && <p className="font-body text-sm text-rv-text-dim">No requests yet.</p>}
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-rv-border py-2 last:border-0">
            <div>
              <p className="font-body text-sm text-rv-text capitalize">{r.type}</p>
              <p className="font-body text-xs text-rv-text-dim">{new Date(r.requestedAt).toLocaleString()}</p>
            </div>
            <span
              className={`font-body text-xs ${
                r.status === "completed" ? "text-rv-cyan" : r.status === "rejected" ? "text-rv-danger" : "text-rv-text-dim"
              }`}
            >
              {r.status}
            </span>
          </div>
        ))}
      </section>

      <Link href="/" className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan">
        ← Back home
      </Link>
    </main>
  );
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $pagePath), $pageContent, $utf8NoBom)
Write-Host "Created: $pagePath" -ForegroundColor Green
