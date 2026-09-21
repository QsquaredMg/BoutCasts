"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, { background: string; color: string; icon: string }> = {
  success: { background: "var(--gold-soft)", color: "var(--gold)", icon: "✓" },
  error: { background: "var(--red-soft)", color: "var(--red)", icon: "!" },
  info: { background: "var(--surface-2)", color: "var(--text-dim)", icon: "ℹ" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const style = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg"
              style={{ background: style.background, color: style.color }}
            >
              <span className="text-xs font-bold">{style.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No provider mounted — degrade to a no-op rather than crashing the page.
    return { showToast: () => {} };
  }
  return ctx;
}
