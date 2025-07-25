"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { logger } from "@/lib/logger";

export function AuthHydration({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mark hydration complete in store
    const markHydrated = async () => {
      const state = useAuthStore.getState();

      // Validate token if user is logged in
      if (state.user && state.accessToken) {
        try {
          // Validate the token is still valid
          const isValid = await authApi.validateToken();
          if (!isValid) {
            // Token was invalid, auth state already cleared by validateToken
            logger.warn(
              "Invalid auth token detected, user has been logged out",
            );
          }
        } catch (error) {
          // Network error or other issue - clear auth to be safe
          logger.error("Failed to validate auth token", error);
          useAuthStore.getState().clearAuth();
        }
      }

      if (!state.isHydrated) {
        useAuthStore.setState({ isHydrated: true });
      }
      setIsReady(true);
    };

    // Wait for store to rehydrate
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      markHydrated();
    });

    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      markHydrated();
    }

    // Set up periodic token validation for long sessions
    const intervalId = setInterval(
      async () => {
        const state = useAuthStore.getState();
        if (state.user && state.accessToken) {
          try {
            await authApi.validateToken();
          } catch (error) {
            logger.error("Token validation check failed", error);
          }
        }
      },
      15 * 60 * 1000,
    ); // Check every 15 minutes

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      clearInterval(intervalId);
    };
  }, []);

  // Show nothing while hydrating to prevent flash of content
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
