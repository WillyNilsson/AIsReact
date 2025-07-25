/**
 * Tests for JWT refresh token rotation functionality
 */

import { _testApiClient as apiClient, authApi } from "../api";
import { useAuthStore } from "@/store/authStore";

// Mock axios
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn(), clear: jest.fn() },
      response: { use: jest.fn(), clear: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock auth store
jest.mock("@/store/authStore", () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

describe("JWT Token Rotation", () => {
  let mockAuthStore: ReturnType<typeof useAuthStore.getState>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock auth store state
    mockAuthStore = {
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "user" as const,
        is_active: true,
        is_verified: true,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      tokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
      isAuthenticated: true,
      isLoading: false,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
      setLoading: jest.fn(),
      updateUser: jest.fn(),
      getTokenExpiry: jest.fn(() => new Date(Date.now() + 30 * 60 * 1000)),
    };

    (useAuthStore.getState as jest.Mock).mockReturnValue(mockAuthStore);
  });

  describe("authApi.logout", () => {
    it("should revoke refresh token on logout", async () => {
      const mockPost = apiClient.post as jest.Mock;
      mockPost.mockResolvedValueOnce({
        data: { detail: "Token revoked successfully" },
      });

      await authApi.logout();

      // Verify revocation request
      expect(mockPost).toHaveBeenCalledWith("/api/auth/token/revoke/", {
        refresh: "old-refresh-token",
      });

      // Verify local auth cleared
      expect(mockAuthStore.clearAuth).toHaveBeenCalled();
    });

    it("should clear auth even if revocation fails", async () => {
      const mockPost = apiClient.post as jest.Mock;
      mockPost.mockRejectedValueOnce(new Error("Server error"));

      // Should not throw
      await authApi.logout();

      // Should still clear local auth
      expect(mockAuthStore.clearAuth).toHaveBeenCalled();
    });

    it("should handle logout without refresh token", async () => {
      mockAuthStore.refreshToken = null;

      await authApi.logout();

      // Should not make revocation request
      expect(apiClient.post).not.toHaveBeenCalledWith(
        "/api/auth/token/revoke/",
        expect.any(Object),
      );

      // Should still clear auth
      expect(mockAuthStore.clearAuth).toHaveBeenCalled();
    });
  });

  describe("authApi.refreshToken", () => {
    it("should update store with rotated tokens", async () => {
      const mockPost = apiClient.post as jest.Mock;
      mockPost.mockResolvedValueOnce({
        data: {
          access: "new-access-token",
          refresh: "new-refresh-token",
        },
      });

      const result = await authApi.refreshToken();

      expect(result).toEqual({
        access: "new-access-token",
        refresh: "new-refresh-token",
      });

      expect(mockPost).toHaveBeenCalledWith("/api/auth/token/refresh/", {
        refresh: "old-refresh-token",
      });

      expect(mockAuthStore.setAuth).toHaveBeenCalledWith(
        mockAuthStore.user,
        "new-access-token",
        "new-refresh-token",
      );
    });

    it("should throw error if no refresh token available", async () => {
      mockAuthStore.refreshToken = null;

      await expect(authApi.refreshToken()).rejects.toThrow(
        "No refresh token available",
      );
    });

    it("should handle refresh without user in store", async () => {
      mockAuthStore.user = null;

      const mockPost = apiClient.post as jest.Mock;
      mockPost.mockResolvedValueOnce({
        data: {
          access: "new-access-token",
          refresh: "new-refresh-token",
        },
      });

      await authApi.refreshToken();

      // Should not call setAuth without user
      expect(mockAuthStore.setAuth).not.toHaveBeenCalled();
    });
  });
});
