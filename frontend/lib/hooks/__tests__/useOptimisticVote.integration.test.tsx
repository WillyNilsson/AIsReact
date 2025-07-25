import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useOptimisticVote } from "../useOptimisticVote";
import { PostFeedItem, PostStatus } from "@/lib/types";

// Create a proper test wrapper with SWR provider
const createWrapper = () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
  Wrapper.displayName = "SWRTestWrapper";
  return Wrapper;
};

// Mock the actual implementations needed
let mockTriggerImplementation: jest.Mock;
let mockSetVote: jest.Mock;
let mockGetVote: jest.Mock;
let mockAddToast: jest.Mock;

jest.mock("swr/mutation", () => ({
  __esModule: true,
  default: () => ({
    trigger: mockTriggerImplementation,
    isMutating: false,
    error: null,
  }),
}));

jest.mock("@/store/voteStore", () => ({
  useVoteStore: () => ({
    setVote: mockSetVote,
    getVote: mockGetVote,
  }),
}));

jest.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    addToast: mockAddToast,
    toasts: [],
  }),
}));

jest.mock("swr", () => ({
  ...jest.requireActual("swr"),
  mutate: jest.fn(() => Promise.resolve()),
}));

// Mock getState for rollback
const voteStoreModule = jest.requireActual("@/store/voteStore");
// @ts-expect-error - Mocking getState for testing
(
  voteStoreModule.useVoteStore as unknown as {
    getState: () => { votes: Map<number, boolean | null> };
  }
).getState = () => ({
  votes: new Map(),
});

describe("useOptimisticVote - Integration Tests", () => {
  const mockPost: PostFeedItem = {
    id: 1,
    title: "Test Post",
    content: "Test post",
    source_url: "https://example.com",
    status: PostStatus.PENDING_VERIFICATION,
    verification_score: 5,
    verification_count: 10,
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerImplementation = jest.fn();
    mockSetVote = jest.fn();
    mockGetVote = jest.fn(() => null);
    mockAddToast = jest.fn();
  });

  it("should perform optimistic update and handle success", async () => {
    // Setup successful API response
    mockTriggerImplementation.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useOptimisticVote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
      });
    });

    // Verify optimistic update happened immediately
    expect(mockSetVote).toHaveBeenCalledWith(1, true);

    // Verify API was called
    expect(mockTriggerImplementation).toHaveBeenCalledWith({
      postId: 1,
      voteData: { vote: true },
    });

    // Verify success toast
    expect(mockAddToast).toHaveBeenCalledWith({
      type: "success",
      title: "Vote submitted",
      description: "Voted as accurate!",
    });
  });

  it("should rollback on API failure", async () => {
    // Setup API failure
    const error = new Error("Network error");
    mockTriggerImplementation.mockRejectedValueOnce(error);
    mockGetVote.mockReturnValue(null); // No previous vote

    const { result } = renderHook(() => useOptimisticVote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.vote({
          postId: 1,
          voteData: { vote: false },
          currentPost: mockPost,
        });
      } catch {
        // Expected error
      }
    });

    // Verify optimistic update happened
    expect(mockSetVote).toHaveBeenCalledWith(1, false);

    // Verify error toast
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: "error",
        title: "Vote submission failed",
        description: expect.any(String),
      });
    });
  });

  it("should handle concurrent votes correctly", async () => {
    // Setup multiple successful responses
    mockTriggerImplementation
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useOptimisticVote(), {
      wrapper: createWrapper(),
    });

    // Start two votes concurrently
    const vote1Promise = act(async () => {
      await result.current.vote({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
      });
    });

    const vote2Promise = act(async () => {
      await result.current.vote({
        postId: 2,
        voteData: { vote: false },
        currentPost: { ...mockPost, id: 2 },
      });
    });

    await Promise.all([vote1Promise, vote2Promise]);

    // Both votes should complete successfully
    expect(mockSetVote).toHaveBeenCalledWith(1, true);
    expect(mockSetVote).toHaveBeenCalledWith(2, false);
    expect(mockAddToast).toHaveBeenCalledTimes(2);
  });
});
