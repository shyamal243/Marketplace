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
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-paper">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-marigold px-2.5 py-0.5 font-body text-xs font-medium text-indigo-deep">
              {unreadCount} new
            </span>
          )}
        </div>

        {loading && <p className="mt-8 font-body text-indigo-border">Loading...</p>}
        {error && (
          <p className="mt-8 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && notifications.length === 0 && (
          <p className="mt-8 font-body text-indigo-border">No notifications yet.</p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={`cursor-pointer rounded-lg border px-5 py-4 transition ${
                n.isRead
                  ? "border-indigo-border/30 bg-indigo-surface/50"
                  : "border-marigold/50 bg-indigo-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className={`font-body text-sm ${n.isRead ? "text-indigo-border" : "text-paper"}`}>
                  {n.message}
                </p>
                {!n.isRead && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-marigold" />
                )}
              </div>
              <p className="mt-2 font-body text-xs text-indigo-border">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
