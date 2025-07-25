import { renderHook } from "@testing-library/react";
import { useVoteSync, usePostVoteStatus } from "../useVoteSync";
import { useVoteStore } from "@/store/voteStore";
import { useAuth } from "@/hooks/useAuth";
import { PostFeedItem, PostStatus } from "@/lib/types";

// Mock dependencies
jest.mock("@/store/voteStore");
jest.mock("@/hooks/useAuth");

const mockSyncVotesFromApi = jest.fn();
const mockClearVotes = jest.fn();
const mockGetVote = jest.fn();

describe("useVoteSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useVoteStore as unknown as jest.Mock).mockReturnValue({
      syncVotesFromApi: mockSyncVotesFromApi,
      clearVotes: mockClearVotes,
      getVote: mockGetVote,
    });
  });

  it("should clear votes when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    renderHook(() => useVoteSync([]));

    expect(mockClearVotes).toHaveBeenCalled();
    expect(mockSyncVotesFromApi).not.toHaveBeenCalled();
  });

  it("should sync votes from API when posts have user_vote data", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 1 } });

    const posts: PostFeedItem[] = [
      {
        id: 1,
        user: {
          id: 2,
          username: "test",
          email: "test@test.com",
          role: "user",
          is_active: true,
          is_verified: true,
          created_at: "",
          updated_at: "",
        },
        title: "Test 1",
        content: "Content 1",
        source_url: "http://example.com",
        status: PostStatus.LIVE,
        created_at: "2024-01-01",
        verification_score: 5,
        verification_count: 10,
        user_vote: true,
      },
      {
        id: 2,
        user: {
          id: 3,
          username: "test2",
          email: "test2@test.com",
          role: "user",
          is_active: true,
          is_verified: true,
          created_at: "",
          updated_at: "",
        },
        title: "Test 2",
        content: "Content 2",
        source_url: "http://example.com",
        status: PostStatus.LIVE,
        created_at: "2024-01-01",
        verification_score: 3,
        verification_count: 8,
        user_vote: false,
      },
      {
        id: 3,
        user: {
          id: 4,
          username: "test3",
          email: "test3@test.com",
          role: "user",
          is_active: true,
          is_verified: true,
          created_at: "",
          updated_at: "",
        },
        title: "Test 3",
        content: "Content 3",
        source_url: "http://example.com",
        status: PostStatus.LIVE,
        created_at: "2024-01-01",
        verification_score: 0,
        verification_count: 0,
        user_vote: null,
      },
    ];

    renderHook(() => useVoteSync(posts));

    expect(mockSyncVotesFromApi).toHaveBeenCalledWith([
      { postId: 1, vote: true },
      { postId: 2, vote: false },
    ]);
  });

  it("should not sync when posts array is empty", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 1 } });

    renderHook(() => useVoteSync([]));

    expect(mockSyncVotesFromApi).not.toHaveBeenCalled();
  });

  it("should not sync when posts is undefined", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 1 } });

    renderHook(() => useVoteSync(undefined));

    expect(mockSyncVotesFromApi).not.toHaveBeenCalled();
  });

  it("should not sync when no posts have user_vote", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 1 } });

    const posts: PostFeedItem[] = [
      {
        id: 1,
        user: {
          id: 2,
          username: "test",
          email: "test@test.com",
          role: "user",
          is_active: true,
          is_verified: true,
          created_at: "",
          updated_at: "",
        },
        title: "Test 1",
        content: "Content 1",
        source_url: "http://example.com",
        status: PostStatus.LIVE,
        created_at: "2024-01-01",
        verification_score: 5,
        verification_count: 10,
      },
    ];

    renderHook(() => useVoteSync(posts));

    expect(mockSyncVotesFromApi).not.toHaveBeenCalled();
  });
});

describe("usePostVoteStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return API vote when available", () => {
    (useVoteStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { getVote: jest.fn().mockReturnValue(false) };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePostVoteStatus(1, true));

    expect(result.current).toBe(true);
  });

  it("should return local vote when API vote is null", () => {
    const mockGetVoteLocal = jest.fn().mockReturnValue(true);
    (useVoteStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { getVote: mockGetVoteLocal };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePostVoteStatus(1, null));

    expect(result.current).toBe(true);
    expect(mockGetVoteLocal).toHaveBeenCalledWith(1);
  });

  it("should return local vote when API vote is undefined", () => {
    const mockGetVoteLocal = jest.fn().mockReturnValue(false);
    (useVoteStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { getVote: mockGetVoteLocal };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePostVoteStatus(1, undefined));

    expect(result.current).toBe(false);
    expect(mockGetVoteLocal).toHaveBeenCalledWith(1);
  });

  it("should return null when no vote exists", () => {
    const mockGetVoteLocal = jest.fn().mockReturnValue(null);
    (useVoteStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { getVote: mockGetVoteLocal };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePostVoteStatus(1, undefined));

    expect(result.current).toBeNull();
  });

  it("should prioritize false API vote over local vote", () => {
    (useVoteStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = { getVote: jest.fn().mockReturnValue(true) };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePostVoteStatus(1, false));

    expect(result.current).toBe(false);
  });
});
