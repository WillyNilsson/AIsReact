"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove toast after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Set toast functions on mount
  React.useEffect(() => {
    setToastFunctions({ addToast, removeToast });
  }, [addToast, removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastColors = {
  success: "bg-green-950 border-green-900 text-green-400",
  error: "bg-red-950 border-red-900 text-red-400",
  warning: "bg-yellow-950 border-yellow-900 text-yellow-400",
  info: "bg-blue-950 border-blue-900 text-blue-400",
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toastIcons[toast.type] || AlertCircle;
  const colorClass = toastColors[toast.type] || toastColors.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-start gap-3 min-w-[300px] max-w-md p-4 rounded-lg border ${colorClass} backdrop-blur-xl shadow-lg`}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm opacity-90 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// Store toast functions outside of component
let toastFunctions: {
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
} | null = null;

// Helper functions for common toast types
export const toast = {
  success: (title: string, description?: string) => {
    if (toastFunctions) {
      toastFunctions.addToast({ type: "success", title, description });
    }
  },
  error: (title: string, description?: string) => {
    if (toastFunctions) {
      toastFunctions.addToast({ type: "error", title, description });
    }
  },
  warning: (title: string, description?: string) => {
    if (toastFunctions) {
      toastFunctions.addToast({ type: "warning", title, description });
    }
  },
  info: (title: string, description?: string) => {
    if (toastFunctions) {
      toastFunctions.addToast({ type: "info", title, description });
    }
  },
};

// Set toast functions from provider
export function setToastFunctions(functions: typeof toastFunctions) {
  toastFunctions = functions;
}
