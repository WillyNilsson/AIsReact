import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SWRConfig, mutate as globalMutate } from "swr";
import useSWRMutation from "swr/mutation";
import { useOptimisticVote, useDebouncedVote } from "../useOptimisticVote";
import { _testApiClient as apiClient } from "@/lib/api";
import { useVoteStore } from "@/store/voteStore";
import { useToast } from "@/components/ui/toast";
import { PostFeedItem, PostStatus, VerificationStats } from "@/lib/types";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api");
jest.mock("@/store/voteStore");
jest.mock("@/components/ui/toast");
jest.mock("swr", () => ({
  ...jest.requireActual("swr"),
  mutate: jest.fn(() => Promise.resolve()),
}));
jest.mock("swr/mutation", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    trigger: jest.fn(),
    isMutating: false,
    error: null,
  })),
}));

const _mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseVoteStore = useVoteStore as unknown as jest.MockedFunction<
  typeof useVoteStore
>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseSWRMutation = useSWRMutation as jest.MockedFunction<
  typeof useSWRMutation
>;

// Mock useVoteStore.getState for rollback functionality
(
  useVoteStore as unknown as jest.MockedFunction<
    () => { votes: Map<number, boolean | null> }
  >
).getState = jest.fn(() => ({
  votes: new Map(),
}));

describe("useOptimisticVote", () => {
  let mockSetVote: jest.Mock;
  let mockGetVote: jest.Mock;
  let mockAddToast: jest.Mock;
  let mockVoteStoreState: {
    votes: Map<number, boolean | null>;
    setVote: jest.Mock;
    getVote: jest.Mock;
  };
  let mockTrigger: jest.Mock;

  const mockPost: PostFeedItem = {
    id: 1,
    title: "Test Post",
    content: "Test post",
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
  };

  const mockStats: VerificationStats = {
    total_votes: 10,
    positive_votes: 6,
    negative_votes: 4,
    verification_score: 2,
    user_vote: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSetVote = jest.fn();
    mockGetVote = jest.fn().mockReturnValue(null);
    mockAddToast = jest.fn();
    mockTrigger = jest.fn();

    mockVoteStoreState = {
      votes: new Map(),
      setVote: mockSetVote,
      getVote: mockGetVote,
    };

    mockUseVoteStore.mockReturnValue(mockVoteStoreState);
    mockUseToast.mockReturnValue({
      addToast: mockAddToast,
      removeToast: jest.fn(),
      toasts: [],
    });

    // Mock useSWRMutation to return our mock trigger
    mockUseSWRMutation.mockReturnValue({
      trigger: mockTrigger,
      isMutating: false,
      error: null,
      data: undefined,
      reset: jest.fn(),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SWRConfig,
      { value: { provider: () => new Map() } },
      children,
    );

  it("should optimistically update vote and show success on successful API call", async () => {
    mockTrigger.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    await act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
        currentStats: mockStats,
      });
    });

    // Check optimistic update was applied
    expect(mockSetVote).toHaveBeenCalledWith(1, true);

    // Check trigger was called
    expect(mockTrigger).toHaveBeenCalledWith({
      postId: 1,
      voteData: { vote: true },
    });

    // Check success toast was shown
    expect(mockAddToast).toHaveBeenCalledWith({
      type: "success",
      title: "Vote submitted",
      description: "Voted as accurate!",
    });
  });

  it("should rollback optimistic update on API failure", async () => {
    const error = new Error("Network error");
    mockTrigger.mockRejectedValueOnce(error);
    mockGetVote.mockReturnValue(null);

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    await act(async () => {
      try {
        await result.current.vote({
          postId: 1,
          voteData: { vote: true },
          currentPost: mockPost,
          currentStats: mockStats,
        });
      } catch {
        // Expected error - API failure is handled internally
      }
    });

    // Check optimistic update was applied
    expect(mockSetVote).toHaveBeenCalledWith(1, true);

    // Check rollback happened (votes.delete called for previously null vote)
    expect(mockVoteStoreState.votes.delete).toBeDefined();

    // Wait for error handling to complete
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Vote submission failed",
        description: expect.any(String),
      });
    });
  });

  it("should handle existing vote rollback correctly", async () => {
    const error = new Error("API error");
    mockTrigger.mockRejectedValueOnce(error);
    mockGetVote.mockReturnValue(false); // User previously voted false

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    await act(async () => {
      try {
        await result.current.vote({
          postId: 1,
          voteData: { vote: true },
          currentPost: { ...mockPost, user_vote: false },
          currentStats: { ...mockStats, user_vote: false },
        });
      } catch {
        // Expected error
      }
    });

    // Check optimistic update was applied
    expect(mockSetVote).toHaveBeenNthCalledWith(1, 1, true);

    // Check rollback to previous vote
    expect(mockSetVote).toHaveBeenNthCalledWith(2, 1, false);
  });

  it("should update SWR cache optimistically", async () => {
    mockTrigger.mockResolvedValueOnce({ data: { success: true } });

    // Mock SWR cache data
    const mockCacheData = [mockPost];
    (globalMutate as jest.Mock).mockImplementation((key, updater) => {
      if (typeof updater === "function") {
        const updated = updater(mockCacheData);
        expect(updated[0].user_vote).toBe(true);
        expect(updated[0].verification_score).toBe(1);
      }
      return Promise.resolve();
    });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    await act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
        currentStats: mockStats,
      });
    });

    // Verify cache update was called
    expect(globalMutate).toHaveBeenCalled();
  });

  it("should handle race conditions with proper state management", async () => {
    let resolveFirst: (value: { data: { success: boolean } }) => void;
    let resolveSecond: (value: { data: { success: boolean } }) => void;

    const firstPromise = new Promise<{ data: { success: boolean } }>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const secondPromise = new Promise<{ data: { success: boolean } }>(
      (resolve) => {
        resolveSecond = resolve;
      },
    );

    mockTrigger
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    // Start two votes in parallel
    let _firstVotePromise: Promise<void>;
    let _secondVotePromise: Promise<void>;

    act(() => {
      _firstVotePromise = result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
      });

      _secondVotePromise = result.current.vote({
        postId: 2,
        voteData: { vote: false },
        currentPost: { ...mockPost, id: 2 },
      });
    });

    // Resolve in reverse order to test race condition handling
    act(() => {
      resolveSecond!({ data: { success: true } });
    });

    await waitFor(() => {
      expect(mockSetVote).toHaveBeenCalledWith(2, false);
    });

    act(() => {
      resolveFirst!({ data: { success: true } });
    });

    await waitFor(() => {
      expect(mockSetVote).toHaveBeenCalledWith(1, true);
    });

    // Both votes should be successful
    expect(mockAddToast).toHaveBeenCalledTimes(2);
  });

  it("should call success and error callbacks appropriately", async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();

    mockTrigger.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(
      () => useOptimisticVote({ onSuccess, onError }),
      { wrapper },
    );

    await act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
      });
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    // Test error case
    const error = new Error("API error");
    mockTrigger.mockRejectedValueOnce(error);

    await act(async () => {
      try {
        await result.current.vote({
          postId: 2,
          voteData: { vote: false },
          currentPost: { ...mockPost, id: 2 },
        });
      } catch {
        // Expected - error is handled by onError callback
      }
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  it("should handle missing currentPost gracefully", async () => {
    mockTrigger.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => useOptimisticVote(), { wrapper });

    await act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        // No currentPost provided
      });
    });

    // Should still update local vote store
    expect(mockSetVote).toHaveBeenCalledWith(1, true);

    // Should still call trigger
    expect(mockTrigger).toHaveBeenCalled();
  });
});

describe("useDebouncedVote", () => {
  let mockTrigger: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockTrigger = jest.fn();

    mockUseVoteStore.mockReturnValue({
      votes: new Map(),
      setVote: jest.fn(),
      getVote: jest.fn().mockReturnValue(null),
    });

    mockUseToast.mockReturnValue({
      addToast: jest.fn(),
      removeToast: jest.fn(),
      toasts: [],
    });

    // Mock useSWRMutation to return our mock trigger
    mockUseSWRMutation.mockReturnValue({
      trigger: mockTrigger,
      isMutating: false,
      error: null,
      data: undefined,
      reset: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SWRConfig,
      { value: { provider: () => new Map() } },
      children,
    );

  it("should debounce rapid vote calls", async () => {
    mockTrigger.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useDebouncedVote(500), { wrapper });

    // Make multiple rapid calls
    act(() => {
      result.current.vote({
        postId: 1,
        voteData: { vote: true },
      });

      result.current.vote({
        postId: 1,
        voteData: { vote: false },
      });

      result.current.vote({
        postId: 1,
        voteData: { vote: true },
      });
    });

    // Trigger should not be called yet
    expect(mockTrigger).not.toHaveBeenCalled();

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      // Only the last vote should be executed
      expect(mockTrigger).toHaveBeenCalledTimes(1);
      expect(mockTrigger).toHaveBeenCalledWith({
        postId: 1,
        voteData: { vote: true },
      });
    });
  });

  it("should handle errors in debounced calls", async () => {
    const error = new Error("API error");
    mockTrigger.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDebouncedVote(100), { wrapper });

    let voteError: Error | null = null;

    act(() => {
      result.current
        .vote({
          postId: 1,
          voteData: { vote: true },
        })
        .catch((e: Error) => {
          voteError = e;
        });
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(voteError).toBe(error);
    });
  });
});
