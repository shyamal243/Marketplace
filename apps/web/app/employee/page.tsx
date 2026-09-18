"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Task {
  id: number;
  taskType: string;
  relatedUserId: number | null;
  title: string;
  description: string | null;
  status: string;
  notes: string | null;
}

const STATUS_FLOW: Record<string, string> = {
  pending: "in_progress",
  in_progress: "completed",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Start task",
  in_progress: "Mark completed",
};

export default function EmployeePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [notesInputs, setNotesInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/employee/tasks");
      setTasks(data);
      const initialNotes: Record<number, string> = {};
      data.forEach((t: Task) => {
        initialNotes[t.id] = t.notes ?? "";
      });
      setNotesInputs(initialNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load — are you an employee?");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvance(task: Task) {
    const nextStatus = STATUS_FLOW[task.status];
    if (!nextStatus) return;

    setUpdating(task.id);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/employee/tasks/${task.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus, notes: notesInputs[task.id] ?? "" }),
      });
      setMessage("Task updated.");
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(null);
    }
  }

  async function handleSaveNotes(task: Task) {
    setUpdating(task.id);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/employee/tasks/${task.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: task.status, notes: notesInputs[task.id] ?? "" }),
      });
      setMessage("Notes saved.");
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Your tasks</h1>
        <p className="mt-2 font-body text-sm text-rv-text-dim">
          Verifications and onboarding work assigned to you.
        </p>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        {!loading && !error && tasks.length === 0 && (
          <p className="mt-8 font-body text-rv-text-dim">No tasks assigned to you right now.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {tasks.map((t) => {
            const nextStatus = STATUS_FLOW[t.status];
            return (
              <div key={t.id} className="glass-panel p-5">
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-semibold text-rv-text">{t.title}</p>
                  <span className="rounded-full border border-rv-border px-2.5 py-0.5 font-body text-xs capitalize text-rv-text-dim">
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 font-body text-xs capitalize text-rv-cyan">{t.taskType.replace(/_/g, " ")}</p>
                {t.relatedUserId && (
                  <p className="mt-1 font-body text-xs text-rv-text-dim">Related user #{t.relatedUserId}</p>
                )}
                {t.description && (
                  <p className="mt-2 font-body text-sm text-rv-text-dim">{t.description}</p>
                )}

                <textarea
                  rows={2}
                  value={notesInputs[t.id] ?? ""}
                  onChange={(e) => setNotesInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="Notes (e.g. vehicle details, verification findings)"
                  className="mt-3 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSaveNotes(t)}
                    disabled={updating === t.id}
                    className="rounded-md border border-rv-border px-3 py-1.5 font-body text-xs text-rv-text transition hover:hud-border hover:text-rv-cyan disabled:opacity-60"
                  >
                    Save notes
                  </button>
                  {nextStatus && (
                    <button
                      onClick={() => handleAdvance(t)}
                      disabled={updating === t.id}
                      className="flex-1 rounded-md bg-rv-magenta px-4 py-1.5 font-body text-xs font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                    >
                      {updating === t.id ? "Updating..." : STATUS_LABEL[t.status]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}