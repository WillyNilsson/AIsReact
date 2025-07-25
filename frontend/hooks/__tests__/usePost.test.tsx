import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePost, PostNotFoundError, PostFetchError } from "../usePost";
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

describe("usePost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      accessToken: "test-token",
    });
  });

  it("should fetch post successfully", async () => {
    const mockPost = {
      id: 1,
      title: "Test Post",
      content: "Test content",
      source_url: "https://example.com",
      image_url: null,
      status: "live",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ai_responses: [],
      verification_score: 0,
      verification_count: 0,
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "user",
        is_active: true,
        is_verified: true,
        created_at: "2024-01-01T00:00:00Z",
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPost,
    });

    const { result } = renderHook(() => usePost(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPost);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/posts/1/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("should handle null post ID", () => {
    const { result } = renderHook(() => usePost(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should handle 404 error", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const { result } = renderHook(() => usePost(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(PostNotFoundError);
    expect(result.current.error?.message).toBe("Post with ID 1 not found");
  });

  it("should handle network error", async () => {
    jest.clearAllMocks(); // Clear previous fetch calls

    // Mock the same error response for all retries
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => usePost(1), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.error).toBeInstanceOf(PostFetchError);
    expect(result.current.error?.message).toContain("Failed to fetch post");
    // Should have retried twice (initial + 2 retries = 3 calls)
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("should handle invalid API response", async () => {
    const invalidPost = {
      id: "not-a-number", // Invalid type
      title: "Test Post",
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => invalidPost,
    });

    const { result } = renderHook(() => usePost(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(PostFetchError);
    expect(result.current.error?.message).toBe(
      "Received invalid post data from server",
    );
  });

  it("should work without auth token", async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      accessToken: null,
    });

    const mockPost = {
      id: 1,
      title: "Test Post",
      content: "Test content",
      source_url: "https://example.com",
      image_url: null,
      status: "live",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ai_responses: [],
      verification_score: 0,
      verification_count: 0,
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "user",
        is_active: true,
        is_verified: true,
        created_at: "2024-01-01T00:00:00Z",
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPost,
    });

    const { result } = renderHook(() => usePost(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/posts/1/",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });
});
