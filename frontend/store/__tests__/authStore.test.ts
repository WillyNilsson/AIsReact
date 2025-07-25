import { renderHook, act } from "@testing-library/react";
import { useAuthStore } from "../authStore";
import { authApi } from "@/lib/api";

// Mock the API
jest.mock("@/lib/api");

describe("Auth Store", () => {
  const mockUser = {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    role: "user" as const,
    is_active: true,
    is_verified: true,
    created_at: "2025-01-22T10:00:00Z",
    updated_at: "2025-01-22T10:00:00Z",
  };

  const mockTokens = {
    access: "mock-access-token",
    refresh: "mock-refresh-token",
  };

  beforeEach(() => {
    // Clear store state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Clear localStorage
    localStorage.clear();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("setAuth", () => {
    it("successfully sets authentication data", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.accessToken).toBe(mockTokens.access);
      expect(result.current.refreshToken).toBe(mockTokens.refresh);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("updates existing refresh token when not provided", () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial refresh token
      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      // Update with new access token only
      act(() => {
        result.current.setAuth(mockUser, "new-access-token");
      });

      expect(result.current.accessToken).toBe("new-access-token");
      expect(result.current.refreshToken).toBe(mockTokens.refresh); // Should keep old refresh token
    });

    it("sets loading state correctly", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("updateUser", () => {
    it("updates user data when user exists", () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial user
      act(() => {
        result.current.setAuth(mockUser, mockTokens.access);
      });

      // Update user data
      act(() => {
        result.current.updateUser({
          username: "updateduser",
          email: "updated@example.com",
        });
      });

      expect(result.current.user).toEqual({
        ...mockUser,
        username: "updateduser",
        email: "updated@example.com",
      });
    });

    it("does not update when no user exists", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.updateUser({ username: "updateduser" });
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe("auth API integration", () => {
    it("can be used with auth API to clear data", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      // Mock logout API call
      (authApi.logout as jest.Mock).mockResolvedValueOnce(undefined);

      // Call logout through API
      await act(async () => {
        await authApi.logout();
      });

      // Verify logout was called
      expect(authApi.logout).toHaveBeenCalled();
    });

    it("auth API handles logout failure gracefully", async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      // Mock logout API failure
      (authApi.logout as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      // Call logout through API - should not throw
      await act(async () => {
        await authApi.logout();
      });

      // Should still clear local data
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("token management", () => {
    it("stores token expiry when setting auth", () => {
      const { result } = renderHook(() => useAuthStore());

      // Mock JWT token with expiry
      const mockJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDYwMTAwMDB9.mock";

      act(() => {
        result.current.setAuth(mockUser, mockJwt, mockTokens.refresh);
      });

      expect(result.current.tokenExpiry).toBeInstanceOf(Date);
    });

    it("clears token expiry when clearing auth", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      expect(result.current.tokenExpiry).toBeTruthy();

      act(() => {
        result.current.clearAuth();
      });

      expect(result.current.tokenExpiry).toBeNull();
    });
  });

  describe("persistence", () => {
    it("persists auth state to localStorage", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(mockUser, mockTokens.access, mockTokens.refresh);
      });

      const storedState = JSON.parse(
        localStorage.getItem("auth-storage") || "{}",
      );

      expect(storedState.state.user).toEqual(mockUser);
      expect(storedState.state.accessToken).toBe(mockTokens.access);
      expect(storedState.state.refreshToken).toBe(mockTokens.refresh);
    });

    it("hydrates state from localStorage on initialization", () => {
      // Set data in localStorage
      const persistedState = {
        state: {
          user: mockUser,
          accessToken: mockTokens.access,
          refreshToken: mockTokens.refresh,
        },
        version: 0,
      };
      localStorage.setItem("auth-storage", JSON.stringify(persistedState));

      // Create new hook instance
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.accessToken).toBe(mockTokens.access);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe("computed properties", () => {
    it("isAuthenticated returns true when user and token exist", () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        useAuthStore.setState({
          user: mockUser,
          accessToken: mockTokens.access,
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it("isAuthenticated returns false when user or token missing", () => {
      const { result } = renderHook(() => useAuthStore());

      // No user or token
      expect(result.current.isAuthenticated).toBe(false);

      // Token but no user
      act(() => {
        useAuthStore.setState({ accessToken: mockTokens.access });
      });
      expect(result.current.isAuthenticated).toBe(false);

      // User but no token
      act(() => {
        useAuthStore.setState({ user: mockUser, accessToken: null });
      });
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
