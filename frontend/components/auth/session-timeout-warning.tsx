"use client";

/**
 * Session Timeout Warning Component
 *
 * Monitors session expiry and warns users before automatic logout.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getMinutesUntilExpiry } from "@/lib/utils/jwt";
import { authApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/errors/messages";

const WARNING_THRESHOLD_MINUTES = 5; // Show warning 5 minutes before expiry
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

export function SessionTimeoutWarning() {
  const router = useRouter();
  const { accessToken, clearAuth, setAuth, user } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(() => {
    clearAuth();
    router.push("/auth/login");
  }, [clearAuth, router]);

  const handleExtendSession = useCallback(async () => {
    if (!accessToken || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const { access, refresh } = await authApi.refreshToken();
      if (user) {
        setAuth(user, access, refresh);
      }
      setShowWarning(false);
      setMinutesRemaining(null);
    } catch (err) {
      const errorMsg = getErrorMessage(err, { action: "update" });
      setError(errorMsg);
      // Auto-logout after error
      setTimeout(() => {
        handleLogout();
      }, 3000);
    } finally {
      setIsRefreshing(false);
    }
  }, [accessToken, isRefreshing, user, setAuth, handleLogout]);

  const checkTokenExpiry = useCallback(() => {
    if (!accessToken) {
      setShowWarning(false);
      setMinutesRemaining(null);
      return;
    }

    const minutes = getMinutesUntilExpiry(accessToken);

    // Token already expired
    if (minutes <= 0) {
      handleLogout();
      return;
    }

    // Show warning if within threshold
    if (minutes <= WARNING_THRESHOLD_MINUTES) {
      setMinutesRemaining(minutes);
      setShowWarning(true);
    } else {
      setShowWarning(false);
      setMinutesRemaining(null);
    }
  }, [accessToken, handleLogout]);

  // Set up interval to check token expiry
  useEffect(() => {
    if (!accessToken) {
      return;
    }

    // Check immediately
    checkTokenExpiry();

    // Set up interval
    checkIntervalRef.current = setInterval(checkTokenExpiry, CHECK_INTERVAL_MS);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [accessToken, checkTokenExpiry]);

  // Handle visibility change to check when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkTokenExpiry();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkTokenExpiry]);

  if (!showWarning) {
    return null;
  }

  return (
    <Dialog
      open={showWarning}
      onOpenChange={(open) => {
        if (!open && !isRefreshing) {
          // User closed dialog without extending, logout for security
          handleLogout();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Session Expiring
          </DialogTitle>
          <DialogDescription>
            {minutesRemaining} minute{minutesRemaining !== 1 ? "s" : ""} left.
            Stay logged in?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isRefreshing}
          >
            Logout
          </Button>
          <Button
            onClick={handleExtendSession}
            isLoading={isRefreshing}
            disabled={isRefreshing}
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
