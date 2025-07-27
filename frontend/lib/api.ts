/**
 * API Client Configuration
 *
 * Centralized API client for all backend communication with automatic
 * token management and error handling.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/lib/types";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/errors/messages";

interface ApiError {
  error?: {
    code: string;
    message: string;
    details?: Record<string, string | string[]>;
  };
  detail?: string;
  status?: number;
}

export class APIError extends Error {
  constructor(
    public override message: string,
    public code: string = "api_error",
    public status?: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "APIError";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Create axios instance (internal use only)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies for refresh token
});

// Export apiClient only for testing purposes
// @internal - DO NOT use apiClient directly in application code, use `api` object instead
export { apiClient as _testApiClient };

// Setup interceptors (moved to a function to avoid initialization issues)
let interceptorsSetup = false;
let refreshPromise: Promise<{ access: string; refresh: string }> | null = null;

function setupInterceptors() {
  if (interceptorsSetup) {
    return;
  }
  interceptorsSetup = true;

  // Request interceptor to add auth token
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useAuthStore.getState().accessToken;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Don't set Content-Type for FormData - let browser set it with boundary
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }
      // Debug logging for voting endpoint
      if (config.url?.includes("/verify/")) {
        // eslint-disable-next-line no-console
        console.log("Vote request config:", {
          url: config.url,
          method: config.method,
          hasToken: !!token,
          tokenPreview: token ? `${token.substring(0, 20)}...` : "none",
          data: config.data,
        });
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor to handle token refresh and error transformation
  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiError>) => {
      // Handle network errors (backend down)
      if (
        !error.response &&
        (error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED")
      ) {
        const message = getErrorMessage("network error");
        const apiError = new APIError(message, "network_error");
        return Promise.reject(apiError);
      }

      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Handle 401 Unauthorized - try to refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        // Skip refresh for login/register endpoints (user not logged in yet)
        if (
          originalRequest.url?.includes("/auth/token/") ||
          originalRequest.url?.includes("/auth/register/")
        ) {
          return Promise.reject(error);
        }

        // If refresh is already in progress, wait for it
        if (refreshPromise) {
          try {
            const tokens = await refreshPromise;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${tokens.access}`;
            }
            return apiClient(originalRequest);
          } catch {
            return Promise.reject(error);
          }
        }

        // Start new refresh process
        refreshPromise = (async () => {
          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (!refreshToken) {
              throw new Error("No refresh token available");
            }

            const response = await apiClient.post("/api/auth/token/refresh/", {
              refresh: refreshToken,
            });
            const { access, refresh: newRefreshToken } = response.data;

            // Update tokens in store (including new refresh token from rotation)
            const { user } = useAuthStore.getState();
            if (user) {
              useAuthStore
                .getState()
                .setAuth(user, access, newRefreshToken || refreshToken);
            }

            return { access, refresh: newRefreshToken };
          } catch {
            // Refresh failed, clear auth and redirect to login
            useAuthStore.getState().clearAuth();
            // Don't redirect during SSR
            if (typeof window !== "undefined") {
              window.location.href = "/auth/login";
            }
            const message = getErrorMessage("session expired");
            throw new APIError(message, "session_expired", 401);
          } finally {
            // Clear the refresh promise after completion
            refreshPromise = null;
          }
        })();

        try {
          const tokens = await refreshPromise;
          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokens.access}`;
          }
          return apiClient(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }

      // Handle 429 Too Many Requests - rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers["retry-after"];
        const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60;

        const message = getErrorMessage("rate limit exceeded");
        const apiError = new APIError(
          `${message}. Please wait ${waitTime} seconds before trying again.`,
          "rate_limit_exceeded",
          429,
          { retryAfter: waitTime },
        );
        return Promise.reject(apiError);
      }

      // Handle 403 Forbidden - only clear auth for critical endpoints
      if (error.response?.status === 403) {
        // Only clear auth if it's a core auth endpoint (indicates token corruption)
        if (originalRequest.url?.includes("/auth/me")) {
          logger.warn(
            "403 on /auth/me - token likely corrupted, clearing auth",
          );
          useAuthStore.getState().clearAuth();
          if (typeof window !== "undefined") {
            window.location.href = "/auth/login";
          }
        }
        // For other 403s, just return the error (user lacks permission for that resource)
        const message = getErrorMessage("access denied");
        const apiError = new APIError(message, "forbidden", 403);
        return Promise.reject(apiError);
      }

      // Transform error to our standard format
      if (error.response) {
        const data = error.response.data;
        let message = "An error occurred";
        let code = "api_error";
        let details: Record<string, unknown> | undefined;

        // Handle our custom error format
        if (data?.error) {
          message = data.error.message || message;
          code = data.error.code || code;
          details = data.error.details;
        }
        // Handle legacy Django format
        else if (data?.detail) {
          message = data.detail;
        }
        // Handle field errors
        else if (typeof data === "object" && Object.keys(data).length > 0) {
          const firstField = Object.keys(data)[0];
          const errorData = data as Record<string, string | string[]>;
          const fieldError = errorData[firstField];
          if (Array.isArray(fieldError) && fieldError.length > 0) {
            message = fieldError[0];
          } else if (typeof fieldError === "string") {
            message = fieldError;
          }
          details = data as Record<string, unknown>;
        }

        const apiError = new APIError(
          message,
          code,
          error.response.status,
          details,
        );
        return Promise.reject(apiError);
      }

      return Promise.reject(error);
    },
  );
}

// Call setup on module load if in browser
if (typeof window !== "undefined") {
  setupInterceptors();
}

// Auth API endpoints
export const authApi = {
  register: async (data: {
    username: string;
    email: string;
    password: string;
  }): Promise<User> => {
    const response = await apiClient.post("/api/auth/register/", data);
    return response.data;
  },

  login: async (data: {
    username: string;
    password: string;
  }): Promise<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    user?: User;
  }> => {
    // OAuth2 requires form data
    const formData = new URLSearchParams();
    formData.append("username", data.username);
    formData.append("password", data.password);

    const response = await apiClient.post("/api/auth/token/", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      // Revoke the refresh token to invalidate the entire token family
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        await apiClient.post("/api/auth/token/revoke/", {
          refresh: refreshToken,
        });
      }
    } catch (error) {
      // Silently fail - we still want to clear local auth
      // In production, this would be logged to monitoring service
      if (error instanceof APIError && error.code === "csrf_failed") {
        // Clear CSRF token to force refresh on next request
        // TODO: Implement CSRF token handling if needed
      }
    }
    // Clear local auth state regardless of revocation result
    useAuthStore.getState().clearAuth();
    // Clear CSRF token on logout
    // TODO: Implement CSRF token handling if needed
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get("/api/auth/me/");
    return response.data;
  },

  updateMe: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch("/api/auth/me/", data);
    return response.data;
  },

  changePassword: async (data: {
    current_password: string;
    new_password: string;
  }): Promise<void> => {
    await apiClient.post("/api/auth/change-password/", data);
  },

  refreshToken: async (): Promise<{ access: string; refresh: string }> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }
    const response = await apiClient.post("/api/auth/token/refresh/", {
      refresh: refreshToken,
    });
    // Update stored tokens with rotated values
    const { access, refresh: newRefreshToken } = response.data;
    const { user } = useAuthStore.getState();
    if (user && newRefreshToken) {
      useAuthStore.getState().setAuth(user, access, newRefreshToken);
    }
    return response.data;
  },

  validateToken: async (): Promise<boolean> => {
    try {
      // Try to get current user data to validate token
      await authApi.getMe();
      return true;
    } catch {
      // If token is invalid, clear auth state
      useAuthStore.getState().clearAuth();
      return false;
    }
  },
};

// Posts API endpoints (placeholder for Sub-Agent 3B)
export const postsApi = {
  create: async () => {
    // To be implemented by Sub-Agent 3B
  },
  getById: async () => {
    // To be implemented by Sub-Agent 3B
  },
};

// Feed API endpoints (placeholder for Sub-Agent 6A)
export const feedApi = {
  getLive: async () => {
    // To be implemented by Sub-Agent 6A
  },
  getRejected: async () => {
    // To be implemented by Sub-Agent 6A
  },
};

// Verification API endpoints (placeholder for Sub-Agent 4B)
export const verificationApi = {
  getQueue: async () => {
    // To be implemented by Sub-Agent 4B
  },
  vote: async () => {
    // To be implemented by Sub-Agent 4B
  },
};

// SWR fetcher function with better error handling
export const fetcher = async (url: string | null | undefined) => {
  // Guard against null/undefined URLs
  if (!url) {
    throw new Error("No URL provided to fetcher");
  }

  setupInterceptors(); // Ensure interceptors are set up
  try {
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    // Re-throw error for SWR to handle
    throw error;
  }
};

// API methods for SWR
export const api = {
  get: (url: string | null | undefined) => {
    if (!url) {
      return Promise.reject(new Error("No URL provided"));
    }
    setupInterceptors();
    return apiClient.get(url).then((res) => res.data);
  },
  post: (url: string | null | undefined, data?: Record<string, unknown>) => {
    if (!url) {
      return Promise.reject(new Error("No URL provided"));
    }
    setupInterceptors();
    return apiClient.post(url, data).then((res) => res.data);
  },
  postFormData: (url: string | null | undefined, formData: FormData) => {
    if (!url) {
      return Promise.reject(new Error("No URL provided"));
    }
    setupInterceptors();
    // Don't set Content-Type header - axios will set it automatically with boundary
    return apiClient.post(url, formData).then((res) => res.data);
  },
  put: (url: string | null | undefined, data?: Record<string, unknown>) => {
    if (!url) {
      return Promise.reject(new Error("No URL provided"));
    }
    setupInterceptors();
    return apiClient.put(url, data).then((res) => res.data);
  },
  delete: (url: string | null | undefined) => {
    if (!url) {
      return Promise.reject(new Error("No URL provided"));
    }
    setupInterceptors();
    return apiClient.delete(url).then((res) => res.data);
  },
  // Legacy API groups
  auth: authApi,
  posts: postsApi,
  feed: feedApi,
  verification: verificationApi,
};
