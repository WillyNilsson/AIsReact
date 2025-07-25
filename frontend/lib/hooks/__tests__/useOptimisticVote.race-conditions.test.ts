import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SWRConfig } from "swr";
import { useOptimisticVote } from "../useOptimisticVote";
import { _testApiClient as apiClient } from "@/lib/api";
import { useVoteStore } from "@/store/voteStore";
import { useToast } from "@/components/ui/toast";
import { PostFeedItem, PostStatus } from "@/lib/types";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api");
jest.mock("@/store/voteStore");
jest.mock("@/components/ui/toast");
jest.mock("swr", () => ({
  ...jest.requireActual("swr"),
  mutate: jest.fn((_key, _data, _options) => Promise.resolve()),
}));
jest.mock("swr/mutation", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    trigger: jest.fn(),
    isMutating: false,
    error: null,
  })),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseVoteStore = useVoteStore as unknown as jest.MockedFunction<
  typeof useVoteStore
>;

// Mock useVoteStore.getState for rollback functionality
// @ts-expect-error - Mocking getState for testing
(
  useVoteStore as { getState: () => { votes: Map<number, boolean | null> } }
).getState = jest.fn(() => ({
  votes: new Map(),
}));
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe("useOptimisticVote - Race Conditions", () => {
  let mockSetVote: jest.Mock;
  let mockGetVote: jest.Mock;
  let mockAddToast: jest.Mock;
  let voteHistory: Array<{ postId: number; vote: boolean; timestamp: number }>;

  const createMockPost = (id: number): PostFeedItem => ({
    id,
    title: `Test Post ${id}`,
    content: `Test post ${id}`,
    source_url: "https://example.com",
    status: PostStatus.PENDING_VERIFICATION,
    verification_score: 0,
    verification_count: 0,
    user_vote: null,
    created_at: "2024-01-01T00:00:00Z",
    user: {
      id: 1,
      username: "testuser",
      email: "test@example.com",
      role: "user" as const,
      is_active: true,
      is_verified: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    ai_response_count: 0,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    voteHistory = [];

    mockSetVote = jest.fn((postId, vote) => {
      voteHistory.push({ postId, vote, timestamp: Date.now() });
    });
    mockGetVote = jest.fn().mockReturnValue(null);
    mockAddToast = jest.fn();

    mockUseVoteStore.mockReturnValue({
      votes: new Map(),
      setVote: mockSetVote,
      getVote: mockGetVote,
    });

    mockUseToast.mockReturnValue({
      addToast: mockAddToast,
      removeToast: jest.fn(),
      toasts: [],
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SWRConfig,
      { value: { provider: () => new Map() } },
      children,
    );

  it("should handle concurrent votes on different posts correctly", async () => {
    const delays = [300, 100, 200]; // Different response times
    const posts = [1, 2, 3].map((id) => createMockPost(id));

    // Set up API responses with different delays
    posts.forEach((post, index) => {
      mockApiClient.post.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: { success: true } }),
              delays[index],
            ),
          ),
      );
    });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // Start all votes concurrently
    const votePromises = posts.map((post, index) =>
      result.current.vote({
        postId: post.id,
        voteData: { vote: index % 2 === 0 }, // Alternate true/false
        currentPost: post,
      }),
    );

    // All optimistic updates should happen immediately
    expect(voteHistory).toHaveLength(3);
    expect(voteHistory[0]).toMatchObject({ postId: 1, vote: true });
    expect(voteHistory[1]).toMatchObject({ postId: 2, vote: false });
    expect(voteHistory[2]).toMatchObject({ postId: 3, vote: true });

    // Wait for all votes to complete
    await Promise.all(votePromises);

    // Verify all success toasts were shown
    expect(mockAddToast).toHaveBeenCalledTimes(3);

    // Verify no rollbacks occurred
    expect(voteHistory).toHaveLength(3); // No additional calls from rollbacks
  });

  it("should handle mixed success and failure with proper rollbacks", async () => {
    const posts = [1, 2, 3].map((id) => createMockPost(id));

    // Post 1: Success after 200ms
    mockApiClient.post.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { success: true } }), 200),
        ),
    );

    // Post 2: Failure after 100ms
    mockApiClient.post.mockImplementationOnce(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("API Error")), 100),
        ),
    );

    // Post 3: Success after 300ms
    mockApiClient.post.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { success: true } }), 300),
        ),
    );

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // Start all votes
    const votePromises = posts.map(async (post, _index) => {
      try {
        await result.current.vote({
          postId: post.id,
          voteData: { vote: true },
          currentPost: post,
        });
      } catch {
        // Expected for post 2
      }
    });

    // Initial optimistic updates
    expect(voteHistory).toHaveLength(3);

    await Promise.all(votePromises);

    // Post 2 should have been rolled back (deleted from store)
    const finalVotes = mockSetVote.mock.calls;

    // Should have 3 initial sets + 0 rollback sets (since vote was null before)
    expect(finalVotes).toHaveLength(3);

    // Check success and error toasts
    const successToasts = mockAddToast.mock.calls.filter(
      (call) => call[0].type === "success",
    );
    const errorToasts = mockAddToast.mock.calls.filter(
      (call) => call[0].type === "error",
    );

    expect(successToasts).toHaveLength(2); // Posts 1 and 3
    expect(errorToasts).toHaveLength(1); // Post 2
  });

  it("should handle rapid votes on the same post", async () => {
    const post = createMockPost(1);
    let apiCallCount = 0;

    mockApiClient.post.mockImplementation(() => {
      apiCallCount++;
      return new Promise((resolve) =>
        setTimeout(() => resolve({ data: { success: true } }), 100),
      );
    });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // User rapidly changes their mind
    act(() => {
      // Vote true
      result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: post,
      });

      // Immediately vote false
      result.current.vote({
        postId: 1,
        voteData: { vote: false },
        currentPost: { ...post, user_vote: true },
      });

      // Then vote true again
      result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: { ...post, user_vote: false },
      });
    });

    // All votes should be initiated
    expect(apiCallCount).toBe(3);

    // Vote history should show all changes
    expect(voteHistory).toEqual([
      expect.objectContaining({ postId: 1, vote: true }),
      expect.objectContaining({ postId: 1, vote: false }),
      expect.objectContaining({ postId: 1, vote: true }),
    ]);
  });

  it("should handle network timeout and recovery", async () => {
    const post = createMockPost(1);

    // First attempt: timeout
    mockApiClient.post.mockImplementationOnce(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Network timeout")), 5000),
        ),
    );

    // Second attempt: success
    mockApiClient.post.mockImplementationOnce(() =>
      Promise.resolve({ data: { success: true } }),
    );

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // First vote attempt
    result.current
      .vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: post,
      })
      .catch(() => {}); // Catch to prevent unhandled rejection

    // Wait a bit but not for full timeout
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // User retries before timeout completes
    const secondVotePromise = result.current.vote({
      postId: 1,
      voteData: { vote: true },
      currentPost: post,
    });

    await secondVotePromise;

    // Should have two optimistic updates
    expect(
      voteHistory.filter((v) => v.postId === 1 && v.vote === true),
    ).toHaveLength(2);

    // Should have one success toast (from second attempt)
    const successToasts = mockAddToast.mock.calls.filter(
      (call) => call[0].type === "success",
    );
    expect(successToasts).toHaveLength(1);
  });

  it("should maintain consistency when switching between posts quickly", async () => {
    const posts = [1, 2, 3, 4, 5].map((id) => createMockPost(id));

    // All succeed but with varying delays
    posts.forEach((_) => {
      mockApiClient.post.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: { success: true } }),
              Math.random() * 300,
            ),
          ),
      );
    });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // User quickly votes on multiple posts
    for (const post of posts) {
      await act(async () => {
        result.current
          .vote({
            postId: post.id,
            voteData: { vote: post.id % 2 === 0 },
            currentPost: post,
          })
          .catch(() => {}); // Don't wait for completion
      });

      // Small delay between votes
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Wait for all to complete
    await waitFor(
      () => {
        expect(mockAddToast).toHaveBeenCalledTimes(5);
      },
      { timeout: 2000 },
    );

    // Verify each post got its correct vote
    const finalVotes = voteHistory.reduce(
      (acc, vote) => {
        acc[vote.postId] = vote.vote;
        return acc;
      },
      {} as Record<number, boolean>,
    );

    expect(finalVotes).toEqual({
      1: false,
      2: true,
      3: false,
      4: true,
      5: false,
    });
  });

  it("should handle rollback with existing vote correctly in race condition", async () => {
    const post = createMockPost(1);
    mockGetVote.mockReturnValue(true); // User previously voted true

    // Both requests will fail
    mockApiClient.post
      .mockRejectedValueOnce(new Error("Error 1"))
      .mockRejectedValueOnce(new Error("Error 2"));

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // Start two conflicting votes
    const vote1Promise = result.current
      .vote({
        postId: 1,
        voteData: { vote: false },
        currentPost: { ...post, user_vote: true },
      })
      .catch(() => {});

    const vote2Promise = result.current
      .vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: { ...post, user_vote: false },
      })
      .catch(() => {});

    await Promise.all([vote1Promise, vote2Promise]);

    // Should have optimistic updates
    const optimisticUpdates = voteHistory.filter((v) => v.postId === 1);
    expect(optimisticUpdates).toHaveLength(2);

    // Both should have rolled back to original value (true)
    const rollbackCalls = mockSetVote.mock.calls.filter(
      (call) => call[0] === 1 && call[1] === true,
    );
    expect(rollbackCalls).toHaveLength(2);
  });
});
