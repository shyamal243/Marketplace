"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

interface Skill {
  id: number;
  skillName: string;
  category: string | null;
  hourlyRate: number;
}

const PRO_CATEGORIES = [
  "maid", "carpenter", "painter", "car-mechanic", "bike-mechanic", "repair",
  "massage", "spa", "haircut", "cleaning", "accountant", "tutor",
  "doctor-human", "doctor-vet", "pet-spa", "senior-care", "child-care", "driver", "other",
];

export default function ProfessionalSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [category, setCategory] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    setLoading(true);
    try {
      const data = await apiFetch("/professional-skills/mine");
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setAdding(true);
    try {
      await apiFetch("/professional-skills", {
        method: "POST",
        body: JSON.stringify({
          skillName,
          category: category || undefined,
          hourlyRate: Number(hourlyRate),
        }),
      });
      setSkillName("");
      setCategory("");
      setHourlyRate("");
      setMessage("Skill added.");
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: number) {
    setError("");
    try {
      await apiFetch(`/professional-skills/${id}/remove`, { method: "POST" });
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Your skills</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          List the services you offer. Buyers can find and book you by category.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        <form onSubmit={handleAddSkill} className="glass-panel mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-rv-text">Add a skill</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              required
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="Skill name (e.g. Electrician, House cleaning)"
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
            >
              <option value="">Select a category (optional)</option>
              {PRO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
            <input
              type="number"
              required
              min={1}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="Hourly rate (₹)"
              className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
            />
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add skill"}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-rv-text">Your listed skills</h2>
          {loading ? (
            <p className="mt-3 font-body text-sm text-rv-text-dim">Loading...</p>
          ) : skills.length === 0 ? (
            <p className="mt-3 font-body text-sm text-rv-text-dim">No skills listed yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {skills.map((s) => (
                <div key={s.id} className="glass-panel flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-body text-sm text-rv-text">{s.skillName}</p>
                    {s.category && (
                      <span className="mt-1 inline-block rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2 py-0.5 font-body text-xs text-rv-cyan">
                        {s.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-semibold text-rv-magenta">₹{s.hourlyRate}/hr</span>
                    <button
                      onClick={() => handleRemove(s.id)}
                      className="font-body text-xs text-rv-text-dim underline hover:text-rv-danger"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}