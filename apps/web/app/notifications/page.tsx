"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Notification {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiFetch("/notifications");
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silently ignore, not critical
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-rv-text">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rv-magenta px-2.5 py-0.5 font-body text-xs font-medium text-rv-bg shadow-hud-glow-magenta">
              {unreadCount} new
            </span>
          )}
        </div>

        {loading && <p className="mt-8 font-body text-rv-text-dim">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
            {error}
          </p>
        )}

        {!loading && !error && notifications.length === 0 && (
          <p className="mt-8 font-body text-rv-text-dim">No notifications yet.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={`cursor-pointer rounded-lg border px-5 py-4 transition ${
                n.isRead
                  ? "border-rv-border/50 bg-rv-panel/50"
                  : "border-rv-cyan/50 bg-rv-panel shadow-hud-glow"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className={`font-body text-sm ${n.isRead ? "text-rv-text-dim" : "text-rv-text"}`}>
                  {n.message}
                </p>
                {!n.isRead && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-rv-cyan animate-hud-pulse" />
                )}
              </div>
              <p className="mt-2 font-body text-xs text-rv-text-dim">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}