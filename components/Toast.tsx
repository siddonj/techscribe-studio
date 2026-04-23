"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-green-500/30 bg-green-500/10 text-green-300",
  error:   "border-red-500/30   bg-red-500/10   text-red-300",
  info:    "border-accent/30    bg-accent/10    text-accent",
};

const TONE_ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle className="w-4 h-4 shrink-0" />,
  error:   <AlertCircle className="w-4 h-4 shrink-0" />,
  info:    <Info         className="w-4 h-4 shrink-0" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={clsx(
                "flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-xl pointer-events-auto",
                "animate-in slide-in-from-right-4 fade-in duration-200",
                TONE_CLASSES[t.tone]
              )}
            >
              {TONE_ICONS[t.tone]}
              <span className="font-medium">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
