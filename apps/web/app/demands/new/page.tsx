"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, trackEvent } from "../../lib/api";

const DURATIONS = [1, 2, 3, 6, 12, 24];
const API_URL = "http://localhost:4000";

export default function NewDemandPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("");
  const [hoursNeeded, setHoursNeeded] = useState("");
  const [durationHours, setDurationHours] = useState(2);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [aiText, setAiText] = useState("");
  const [aiPhoto, setAiPhoto] = useState<File | null>(null);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDrafted, setAiDrafted] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micError, setMicError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setMicError("Microphone access was denied or isn't available in this browser.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function clearRecording() {
    setAudioBlob(null);
  }

  async function handleAiDraft(e: React.FormEvent) {
    e.preventDefault();
    setAiError("");

    if (!aiText && !aiPhoto && !audioBlob) {
      setAiError("Type something, add a photo, or record a voice note first.");
      return;
    }

    setAiDrafting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      if (aiText) formData.append("text", aiText);
      if (aiPhoto) formData.append("photo", aiPhoto);
      if (audioBlob) formData.append("audio", audioBlob, "voice-note.webm");

      const res = await fetch(`${API_URL}/demands/ai-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not draft this demand");

      setTitle(data.title || "");
      setDescription(data.description || "");
      setCategory(data.category || "");
      setBudget(data.budget ? String(data.budget) : "");
      setHoursNeeded(data.hoursNeeded ? String(data.hoursNeeded) : "");
      setAiDrafted(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiDrafting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const demand = await apiFetch("/demands", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          budget: budget ? Number(budget) : undefined,
          category: category || undefined,
          hoursNeeded: hoursNeeded ? Number(hoursNeeded) : undefined,
          durationHours,
        }),
      });

      trackEvent("post_demand", { category, budget: budget ? Number(budget) : undefined });
      router.push(`/demands/${demand.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Post a demand</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Describe what you need. A ₹10 booking fee applies once you post —
          refunded automatically if no one bids.
        </p>

        <form onSubmit={handleAiDraft} className="hud-border glass-panel mt-8 p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold text-rv-cyan">✦ Draft with AI</h2>
          <p className="mt-1 font-body text-xs text-rv-text-dim">
            Type roughly what you need, attach a photo, or record a voice note — we&apos;ll clean it up and suggest a category.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <textarea
              rows={2}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="e.g. need too replace my brokn kitchen tap asap"
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none"
            />

            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-2 rounded-md border border-rv-border px-3 py-2 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                >
                  🎤 Record voice note
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 rounded-md border border-rv-danger bg-rv-danger/10 px-3 py-2 font-body text-sm text-rv-danger animate-hud-pulse"
                >
                  ● Stop recording
                </button>
              )}
              {audioBlob && !isRecording && (
                <div className="flex items-center gap-2">
                  <span className="font-body text-xs text-rv-cyan">Voice note ready</span>
                  <button
                    type="button"
                    onClick={clearRecording}
                    className="font-body text-xs text-rv-text-dim underline hover:text-rv-danger"
                  >
                    clear
                  </button>
                </div>
              )}
            </div>
            {micError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                {micError}
              </p>
            )}

            {aiError && (
              <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                {aiError}
              </p>
            )}
            {aiDrafted && !aiError && (
              <p className="rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-3 py-2 font-body text-sm text-rv-cyan">
                Draft ready below — review and edit before posting.
              </p>
            )}
            <button
              type="submit"
              disabled={aiDrafting}
              className="rounded-md bg-rv-cyan px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
            >
              {aiDrafting ? "Drafting..." : "Draft with AI"}
            </button>
          </div>
        </form>

        <form onSubmit={handleSubmit} className="glass-panel mt-6 flex flex-col gap-5 p-6 md:p-8">
          <div>
            <label htmlFor="title" className="font-body text-sm font-medium text-rv-text">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              placeholder="e.g. Need 500 cotton t-shirts, or Need a maid"
            />
          </div>

          <div>
            <label htmlFor="description" className="font-body text-sm font-medium text-rv-text">
              Description <span className="text-rv-text-dim">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              placeholder="Any details sellers or workers should know"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="budget" className="font-body text-sm font-medium text-rv-text">
                Budget <span className="text-rv-text-dim">(optional)</span>
              </label>
              <input
                id="budget"
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="₹"
              />
            </div>

            <div>
              <label htmlFor="category" className="font-body text-sm font-medium text-rv-text">
                Category <span className="text-rv-text-dim">(optional)</span>
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                placeholder="e.g. clothing, cleaning, maid"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hoursNeeded" className="font-body text-sm font-medium text-rv-text">
              Hours needed <span className="text-rv-text-dim">(for hourly services like cleaning, massage, carpentry)</span>
            </label>
            <input
              id="hoursNeeded"
              type="number"
              min={1}
              value={hoursNeeded}
              onChange={(e) => setHoursNeeded(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              placeholder="e.g. 3"
            />
          </div>

          <div>
            <span className="font-body text-sm font-medium text-rv-text">Bidding window</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {DURATIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                    durationHours === h
                      ? "border-rv-cyan bg-rv-cyan/10 text-rv-text shadow-hud-glow"
                      : "border-rv-border bg-rv-panel text-rv-text-dim hover:border-rv-cyan/40"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
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
            {loading ? "Posting..." : "Post demand"}
          </button>
        </form>
      </div>
    </div>
  );
}