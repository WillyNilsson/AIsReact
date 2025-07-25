/**
 * Simplified useAuth Hook for components that don't need routing
 */

import { useAuthStore } from "@/store/authStore";

export function useAuthSimple() {
  const { user, isAuthenticated, isLoading, clearAuth } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    logout: clearAuth,
  };
}
