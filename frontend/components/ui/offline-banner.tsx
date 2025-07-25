"use client";

import { useEffect, useState } from "react";
import { WifiOff, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OfflineBannerProps {
  className?: string;
  position?: "top" | "bottom";
}

export function OfflineBanner({
  className,
  position = "top",
}: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);
    setShowBanner(!navigator.onLine);

    // Event handlers
    const handleOnline = () => {
      setIsOnline(true);
      // Show reconnected message briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setIsReconnecting(false);
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic connectivity check
    const checkConnection = setInterval(async () => {
      if (!navigator.onLine) {
        return;
      }

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/health/`, {
          method: "HEAD",
          cache: "no-cache",
        });
        if (!response.ok && isOnline) {
          handleOffline();
        }
      } catch {
        if (isOnline) {
          handleOffline();
        }
      }
    }, 300000); // Check every 5 minutes instead of 30 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(checkConnection);
    };
  }, [isOnline]);

  const handleReconnect = async () => {
    setIsReconnecting(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/health/`, {
        method: "HEAD",
        cache: "no-cache",
      });

      if (response.ok) {
        setIsOnline(true);
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
    } catch {
      // Still offline
    } finally {
      setIsReconnecting(false);
    }
  };

  const positionClasses = {
    top: "top-0",
    bottom: "bottom-0",
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: position === "top" ? -100 : 100 }}
          animate={{ y: 0 }}
          exit={{ y: position === "top" ? -100 : 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed left-0 right-0 z-50",
            positionClasses[position],
            className,
          )}
        >
          <div
            className={cn(
              "px-4 py-3",
              isOnline
                ? "bg-green-600 dark:bg-green-700"
                : "bg-red-600 dark:bg-red-700",
            )}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <WifiOff className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">
                  {isOnline
                    ? "Connection restored! You're back online."
                    : "No internet connection. Some features may be unavailable."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isOnline && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    className="text-white hover:bg-white/20"
                  >
                    {isReconnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Retry
                      </>
                    )}
                  </Button>
                )}

                <button
                  onClick={() => setShowBanner(false)}
                  className="p-1 rounded-lg text-white hover:bg-white/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for components to check online status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
