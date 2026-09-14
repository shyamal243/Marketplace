"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:4000";

interface KycDoc {
  id: number;
  documentType: string;
  status: string;
  rejectionReason: string | null;
}

export default function KycPage() {
  const [kycStatus, setKycStatus] = useState<string>("");
  const [documents, setDocuments] = useState<KycDoc[]>([]);
  const [documentType, setDocumentType] = useState("aadhaar");
  const [documentNumber, setDocumentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadKyc();
  }, []);

  async function loadKyc() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/kyc/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setKycStatus(data.kycStatus);
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setUploading(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("documentType", documentType);
      if (documentNumber) formData.append("documentNumber", documentNumber);
      if (file) formData.append("document", file);

      const res = await fetch(`${API_URL}/kyc/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setMessage("Document submitted for review.");
      setDocumentNumber("");
      setFile(null);
      await loadKyc();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-indigo-deep px-8 py-12 text-paper md:px-16">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Verification (KYC)</h1>
        <p className="mt-2 font-body text-sm text-indigo-border">
          Overall status: <span className="text-marigold">{kycStatus}</span>
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        <form onSubmit={handleUpload} className="mt-6 rounded-lg bg-paper p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Submit a document</h2>
          <div className="mt-4 flex flex-col gap-3">
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            >
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="bank_account">Bank account</option>
              <option value="photo">Photo</option>
            </select>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Document number (optional)"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
            />
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-sm text-ink outline-none"
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Submit"}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-paper">Your documents</h2>
          {documents.length === 0 ? (
            <p className="mt-3 font-body text-sm text-indigo-border">No documents submitted yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {documents.map((d) => (
                <div key={d.id} className="rounded-lg bg-indigo-surface px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-sm capitalize text-paper">
                      {d.documentType.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border border-indigo-border px-2.5 py-0.5 font-body text-xs text-indigo-border">
                      {d.status}
                    </span>
                  </div>
                  {d.rejectionReason && (
                    <p className="mt-1 font-body text-xs text-red-300">{d.rejectionReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
