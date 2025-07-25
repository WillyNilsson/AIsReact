"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionIndicator() {
  const { accessToken } = useAuthStore();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  // Parse JWT to get expiry time
  const getTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }, []);

  // Update time remaining
  useEffect(() => {
    if (!accessToken) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const expiry = getTokenExpiry(accessToken);
      if (!expiry) {
        return;
      }

      const remaining = expiry - Date.now();
      setTimeRemaining(remaining);
      setIsExpiringSoon(remaining > 0 && remaining <= 5 * 60 * 1000); // 5 minutes
    };

    // Initial update
    updateTime();

    // Update every second when expiring soon, otherwise every 30 seconds
    const interval = setInterval(updateTime, isExpiringSoon ? 1000 : 30000);

    return () => clearInterval(interval);
  }, [accessToken, getTokenExpiry, isExpiringSoon]);

  // Don't show if no token or expired
  if (!accessToken || !timeRemaining || timeRemaining <= 0) {
    return null;
  }

  // Only show indicator when less than 15 minutes remaining
  if (timeRemaining > 15 * 60 * 1000) {
    return null;
  }

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
        isExpiringSoon
          ? "bg-destructive/10 text-destructive animate-pulse"
          : "bg-muted text-muted-foreground",
      )}
      title={`Session expires in ${formatTime(timeRemaining)}`}
    >
      <Clock className="h-3 w-3" />
      <span>{formatTime(timeRemaining)}</span>
    </div>
  );
}
