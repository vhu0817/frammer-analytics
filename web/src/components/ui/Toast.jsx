/**
 * Toast notification system — global, lightweight, zero dependencies.
 *
 * Uses a Zustand store so any component can fire a toast, and a
 * ToastContainer renders all active toasts in a fixed portal.
 *
 * Usage:
 *   import { useToastStore } from "@/components/ui/Toast";
 *   const toast = useToastStore((s) => s.toast);
 *   toast.success("Data loaded!");
 *   toast.error("Something went wrong");
 *   toast.info("Filters applied");
 */

import { useEffect } from "react";
import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 4000;

// ── Store ──────────────────────────────────────────────────

export const useToastStore = create((set, get) => ({
  toasts: [],

  _add: (type, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // auto-dismiss
    setTimeout(() => get()._remove(id), AUTO_DISMISS_MS);
    return id;
  },

  _remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // public API — call these from anywhere
  toast: {
    success: (msg) => useToastStore.getState()._add("success", msg),
    error:   (msg) => useToastStore.getState()._add("error",   msg),
    info:    (msg) => useToastStore.getState()._add("info",    msg),
  },
}));

// Convenience export — the most common usage
export const toast = {
  success: (msg) => useToastStore.getState()._add("success", msg),
  error:   (msg) => useToastStore.getState()._add("error",   msg),
  info:    (msg) => useToastStore.getState()._add("info",    msg),
};

// ── Config ─────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/30 text-emerald-400",
    iconClass: "text-emerald-400",
  },
  error: {
    icon: XCircle,
    className: "border-red-500/30 text-red-400",
    iconClass: "text-red-400",
  },
  info: {
    icon: Info,
    className: "border-blue-500/30 text-blue-400",
    iconClass: "text-blue-400",
  },
};

// ── Single Toast ───────────────────────────────────────────

function ToastItem({ toast: t }) {
  const remove = useToastStore((s) => s._remove);
  const config = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", damping: 24, stiffness: 300 }}
      className={cn(
        "flex items-center gap-3 glass-card px-4 py-3 pr-3 shadow-xl min-w-[280px] max-w-sm",
        config.className
      )}
      id={`toast-${t.id}`}
    >
      <Icon className={cn("size-4 shrink-0", config.iconClass)} />
      <p className="flex-1 text-[13px] font-medium text-foreground leading-snug">
        {t.message}
      </p>
      <button
        onClick={() => remove(t.id)}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

// ── Container — render this once in App.jsx ────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end"
      id="toast-container"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
