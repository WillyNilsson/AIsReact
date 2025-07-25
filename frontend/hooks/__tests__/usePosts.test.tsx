import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePosts } from "../usePosts";
import { useAuthStore } from "@/store/authStore";

jest.mock("@/store/authStore", () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

global.fetch = jest.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      accessToken: "test-token",
    });
  });

  it("should fetch posts successfully", async () => {
    const mockPosts = {
      results: [
        {
          id: 1,
          title: "Post 1",
          content: "Content 1",
          source_url: "https://example.com/1",
          image_url: null,
          status: "live",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          ai_responses: [],
          verification_score: 0,
          verification_count: 0,
          user: {
            id: 1,
            username: "user1",
            email: "user1@example.com",
            role: "user",
            is_active: true,
            is_verified: true,
            created_at: "2024-01-01T00:00:00Z",
          },
        },
      ],
      count: 1,
      next: null,
      previous: null,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPosts,
    });

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPosts);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/posts/?status=live&page=1&limit=10",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("should handle custom options", async () => {
    const mockPosts = {
      results: [],
      count: 0,
      next: null,
      previous: null,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPosts,
    });

    const { result } = renderHook(
      () => usePosts({ status: "pending_verification", page: 2, limit: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/posts/?status=pending_verification&page=2&limit=20",
      expect.any(Object),
    );
  });

  it("should handle API error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
    });

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("Failed to fetch posts");
  });

  it("should handle invalid API response", async () => {
    const invalidResponse = {
      results: "not-an-array", // Invalid type
      count: 0,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => invalidResponse,
    });

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe(
      "Received invalid posts data from server",
    );
  });
});
