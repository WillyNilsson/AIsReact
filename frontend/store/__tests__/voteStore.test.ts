import { renderHook, act } from "@testing-library/react";
import { useVoteStore, storageConfig } from "../voteStore";

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

describe("VoteStore", () => {
  beforeEach(() => {
    // Clear all mocks and reset store
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    const { result } = renderHook(() => useVoteStore());
    act(() => {
      result.current.clearVotes();
    });
  });

  describe("setVote", () => {
    it("should add a new vote to the store", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
      });

      expect(result.current.getVote(1)).toBe(true);
    });

    it("should update an existing vote", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
        result.current.setVote(1, false);
      });

      expect(result.current.getVote(1)).toBe(false);
    });

    it("should handle multiple votes", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
        result.current.setVote(2, false);
        result.current.setVote(3, true);
      });

      expect(result.current.getVote(1)).toBe(true);
      expect(result.current.getVote(2)).toBe(false);
      expect(result.current.getVote(3)).toBe(true);
    });
  });

  describe("getVote", () => {
    it("should return null for non-existent votes", () => {
      const { result } = renderHook(() => useVoteStore());

      expect(result.current.getVote(999)).toBeNull();
    });

    it("should return the correct vote value", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, false);
      });

      expect(result.current.getVote(1)).toBe(false);
    });
  });

  describe("clearVotes", () => {
    it("should remove all votes from the store", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
        result.current.setVote(2, false);
        result.current.clearVotes();
      });

      expect(result.current.getVote(1)).toBeNull();
      expect(result.current.getVote(2)).toBeNull();
    });
  });

  describe("syncVotesFromApi", () => {
    it("should add multiple votes from API", () => {
      const { result } = renderHook(() => useVoteStore());

      const apiVotes = [
        { postId: 1, vote: true },
        { postId: 2, vote: false },
        { postId: 3, vote: true },
      ];

      act(() => {
        result.current.syncVotesFromApi(apiVotes);
      });

      expect(result.current.getVote(1)).toBe(true);
      expect(result.current.getVote(2)).toBe(false);
      expect(result.current.getVote(3)).toBe(true);
    });

    it("should overwrite existing votes", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
        result.current.syncVotesFromApi([{ postId: 1, vote: false }]);
      });

      expect(result.current.getVote(1)).toBe(false);
    });

    it("should handle empty array", () => {
      const { result } = renderHook(() => useVoteStore());

      act(() => {
        result.current.setVote(1, true);
        result.current.syncVotesFromApi([]);
      });

      expect(result.current.getVote(1)).toBe(true);
    });
  });

  describe.skip("storage serialization", () => {
    it("should correctly serialize Map to array for storage", () => {
      const testState = {
        state: {
          votes: new Map([[1, { postId: 1, vote: true, timestamp: 12345 }]]),
        },
      };

      // Mock window.localStorage directly
      const originalLocalStorage = global.localStorage;
      const mockSetItem = jest.fn();
      global.localStorage = {
        ...originalLocalStorage,
        setItem: mockSetItem,
      } as any;

      storageConfig.setItem("test-key", testState);

      expect(mockSetItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify({
          state: {
            votes: [[1, { postId: 1, vote: true, timestamp: 12345 }]],
          },
        }),
      );

      // Restore original
      global.localStorage = originalLocalStorage;
    });

    it("should correctly deserialize array to Map from storage", () => {
      const storedData = JSON.stringify({
        state: {
          votes: [[2, { postId: 2, vote: false, timestamp: 67890 }]],
        },
      });

      // Mock window.localStorage directly
      const originalLocalStorage = global.localStorage;
      const mockGetItem = jest.fn().mockReturnValue(storedData);
      global.localStorage = {
        ...originalLocalStorage,
        getItem: mockGetItem,
      } as any;

      const retrieved = storageConfig.getItem("test-key");

      expect(mockGetItem).toHaveBeenCalledWith("test-key");
      expect(retrieved?.state.votes).toBeInstanceOf(Map);
      expect(retrieved?.state.votes.get(2)).toEqual({
        postId: 2,
        vote: false,
        timestamp: 67890,
      });

      // Restore original
      global.localStorage = originalLocalStorage;
    });

    it("should handle null storage values", () => {
      // Mock window.localStorage directly
      const originalLocalStorage = global.localStorage;
      const mockGetItem = jest.fn().mockReturnValue(null);
      global.localStorage = {
        ...originalLocalStorage,
        getItem: mockGetItem,
      } as any;

      const retrieved = storageConfig.getItem("test-key");

      expect(retrieved).toBeNull();

      // Restore original
      global.localStorage = originalLocalStorage;
    });
  });
});
