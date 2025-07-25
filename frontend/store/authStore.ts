/**
 * Authentication Store
 *
 * Manages user authentication state using Zustand with persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User } from "@/lib/types";
import { getTokenExpiry } from "@/lib/utils/jwt";
import { logger } from "@/lib/logger";

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  getTokenExpiry: () => Date | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,

      // Set authentication data
      setAuth: (user: User, accessToken: string, refreshToken?: string) => {
        const tokenExpiry = getTokenExpiry(accessToken);
        set({
          user,
          accessToken,
          refreshToken: refreshToken || get().refreshToken,
          tokenExpiry,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      // Clear authentication data
      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      // Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Update user data
      updateUser: (updates: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              ...updates,
            },
          });
        }
      },

      // Refresh user data from API
      refreshUser: async () => {
        try {
          const authApi = (await import("@/lib/api")).authApi;
          const userData = await authApi.getMe();
          const currentState = get();
          if (currentState.isAuthenticated && userData) {
            set({
              user: userData,
            });
          }
        } catch (error) {
          logger.error("Failed to refresh user data", error);
        }
      },

      // Get token expiry date
      getTokenExpiry: () => {
        return get().tokenExpiry;
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiry: state.tokenExpiry?.toISOString() || null,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert tokenExpiry string back to Date
        if (
          state &&
          state.tokenExpiry &&
          typeof state.tokenExpiry === "string"
        ) {
          state.tokenExpiry = new Date(state.tokenExpiry);
        }
        // Mark as hydrated after rehydration completes
        if (state) {
          state.isHydrated = true;
        }
      },
    },
  ),
);

// Selector hooks for common use cases
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAccessToken = () => useAuthStore((state) => state.accessToken);
export const useIsHydrated = () => useAuthStore((state) => state.isHydrated);
