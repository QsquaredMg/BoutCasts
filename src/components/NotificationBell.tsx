"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

const TYPE_ICON: Record<string, string> = {
  follow: "👤",
  challenge: "🥊",
  challenge_response: "🥊",
  badge: "🏅",
};

function timeAgo(iso: string) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data ?? []) as Notification[]);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border text-base"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "var(--red)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-20 w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border shadow-lg"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="border-b px-3.5 py-3 text-sm font-bold"
            style={{ borderColor: "var(--border)", fontFamily: "var(--font-display)" }}
          >
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              Nothing yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n, i) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => setOpen(false)}
                  className="flex gap-2.5 px-3.5 py-2.5 text-sm"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    background: n.is_read ? "transparent" : "var(--blue-soft)",
                  }}
                >
                  <span className="flex-shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <span className="flex-1">
                    <span className="font-semibold leading-snug">{n.body}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--text-faint)" }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
