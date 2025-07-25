/**
 * useAuth Hook
 *
 * Provides authentication functionality and state management.
 */

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useIsHydrated } from "@/store/authStore";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { ErrorWithResponse } from "@/lib/types/errors";
import { LoginResponse, RegisterResponse } from "@/lib/types/auth";
import { getErrorMessage } from "@/lib/errors/messages";

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export function useAuth() {
  const router = useRouter();
  const isHydrated = useIsHydrated();
  const {
    user,
    isAuthenticated,
    isLoading,
    setAuth,
    clearAuth,
    setLoading,
    updateUser,
  } = useAuthStore();

  // Check if user is authenticated on mount (only after hydration)
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const checkAuth = async () => {
      const token = useAuthStore.getState().accessToken;
      if (token && !user) {
        try {
          setLoading(true);
          const userData = await api.auth.getMe();
          setAuth(userData, token);
        } catch (error) {
          // Token is invalid, clear auth
          clearAuth();
        } finally {
          setLoading(false);
        }
      }
    };

    checkAuth();
  }, [isHydrated, user, setAuth, clearAuth, setLoading]);

  // Login function
  const login = useCallback(
    async (data: LoginData) => {
      try {
        setLoading(true);

        // Login and get tokens
        const tokenResponse = await api.auth.login(data);

        // Check if user data is included in response
        if (tokenResponse.user) {
          // Use user data from response
          setAuth(
            tokenResponse.user,
            tokenResponse.access_token,
            tokenResponse.refresh_token,
          );
        } else {
          // Fallback: Get user data separately
          const userData = await api.auth.getMe();
          setAuth(
            userData,
            tokenResponse.access_token,
            tokenResponse.refresh_token,
          );
        }

        return { success: true };
      } catch (error) {
        // Login error handled - returning error message
        const err = error as ErrorWithResponse;
        let message =
          err.response?.data?.detail || err.message || "Login failed";

        // Use specific error message based on error type
        message = getErrorMessage(message, { action: "login" });

        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading],
  );

  // Register function
  const register = useCallback(
    async (data: RegisterData) => {
      try {
        setLoading(true);

        // Register user - this returns user data with tokens
        const response = await api.auth.register(data);

        // Check if response includes tokens (Django returns them directly)
        if ("access_token" in response) {
          // Store auth data from registration response
          const userData = {
            id: response.id,
            username: response.username,
            email: response.email,
            role: response.role,
            created_at: response.created_at,
            is_verified: response.is_verified,
          };
          const authResponse = response as RegisterResponse;
          setAuth(
            userData as User,
            authResponse.access_token,
            authResponse.refresh_token,
          );
          return { success: true };
        } else {
          // Auto-login after registration if no tokens returned
          const loginResult = await login({
            username: data.username,
            password: data.password,
          });
          return loginResult;
        }
      } catch (error) {
        // Registration error handled - parsing error message
        let message = "Registration failed";
        let field: string | undefined;

        const err = error as ErrorWithResponse;
        if (err.response?.data) {
          const data = err.response.data;

          // Handle Django field-specific errors
          if (typeof data === "object" && !data.detail) {
            // Extract first error message from field errors
            const firstField = Object.keys(data)[0];
            field = firstField;
            if (
              firstField &&
              Array.isArray(data[firstField]) &&
              data[firstField].length > 0
            ) {
              message = data[firstField][0];
            } else if (firstField && typeof data[firstField] === "string") {
              message = data[firstField];
            }
          } else if (data.detail) {
            // Handle general error messages
            message = data.detail;
          }
        } else if (error instanceof Error) {
          message = error.message;
        }

        // Use specific error message based on error type
        message = getErrorMessage(message, { action: "register", field });

        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [login, setLoading],
  );

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      // Only call logout endpoint if we have a token
      if (useAuthStore.getState().accessToken) {
        await api.auth.logout();
      }
    } catch (error) {
      // Even if logout fails, clear local auth
      // Logout error handled - proceeding with local cleanup
    } finally {
      clearAuth();
      router.push("/");
      setLoading(false);
    }
  }, [clearAuth, router, setLoading]);

  // Update user profile
  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      try {
        setLoading(true);
        const updatedUser = await api.auth.updateMe(data);
        updateUser(updatedUser);
        return { success: true };
      } catch (error) {
        let message = "Update failed";
        const err = error as ErrorWithResponse;
        if (err.response?.data?.detail) {
          message = err.response.data.detail;
        } else if (error instanceof Error) {
          message = error.message;
        }

        // Use specific error message
        message = getErrorMessage(message, { action: "update" });

        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [updateUser, setLoading],
  );

  // Change password
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      try {
        setLoading(true);
        await api.auth.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        return { success: true };
      } catch (error) {
        let message = "Password change failed";
        const err = error as ErrorWithResponse;
        if (err.response?.data?.detail) {
          message = err.response.data.detail;
        } else if (error instanceof Error) {
          message = error.message;
        }

        // Use specific error message
        message = getErrorMessage(message, {
          action: "update",
          field: "password",
        });

        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading],
  );

  return {
    // State
    user,
    isAuthenticated,
    isLoading,

    // Actions
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };
}
