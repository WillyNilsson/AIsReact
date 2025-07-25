import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockApiResponses,
  mockAuthStore,
  waitForAsync,
} from "@/lib/test-utils";
import VerifyPage from "@/app/(protected)/verify/page";
import FeedCard from "@/components/feed/feed-card";

// Mock is already set up in jest.setup.js
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/verify",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/verify",
  useParams: () => ({}),
}));

describe("Voting Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore(true, mockApiResponses.login.success.user);

    // Clear vote store
    const voteStore = require("@/store/voteStore").useVoteStore;
    voteStore.setState({
      pendingVotes: new Map(),
      voteHistory: new Map(),
      optimisticUpdates: new Map(),
    });
  });

  describe("Verification Voting", () => {
    it("should load posts for verification and allow voting", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "GET /api/verification/posts": {
          data: mockApiResponses.verification.posts,
        },
        "POST /api/verification/posts/4/vote": {
          data: mockApiResponses.verification.vote.success,
        },
      });

      render(<VerifyPage />);

      // Wait for posts to load
      await waitFor(() => {
        expect(screen.getByText("Post to Verify")).toBeInTheDocument();
      });

      // Find and click vote button
      const voteButton = screen.getByRole("button", { name: /vote/i });
      await user.click(voteButton);

      // Verify optimistic update
      expect(screen.getByText("3")).toBeInTheDocument(); // Updated vote count

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/verification/posts/4/vote"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer mock-jwt-token",
            }),
          }),
        );
      });

      // Verify success feedback
      expect(
        screen.getByText(/vote recorded successfully/i),
      ).toBeInTheDocument();
    });

    it("should handle duplicate vote attempts", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "GET /api/verification/posts": {
          data: [
            {
              ...mockApiResponses.verification.posts[0],
              has_user_voted: true,
            },
          ],
        },
        "POST /api/verification/posts/4/vote": {
          error: mockApiResponses.verification.vote.failure,
          status: 400,
        },
      });

      render(<VerifyPage />);

      await waitFor(() => {
        expect(screen.getByText("Post to Verify")).toBeInTheDocument();
      });

      // Vote button should be disabled
      const voteButton = screen.getByRole("button", { name: /voted/i });
      expect(voteButton).toBeDisabled();

      // Try to click anyway
      await user.click(voteButton);

      // Should not make API call
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/vote"),
        expect.any(Object),
      );
    });

    it("should handle voting errors with rollback", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "GET /api/verification/posts": {
          data: mockApiResponses.verification.posts,
        },
        "POST /api/verification/posts/4/vote": {
          error: { detail: "Server error" },
          status: 500,
        },
      });

      render(<VerifyPage />);

      await waitFor(() => {
        expect(screen.getByText("Post to Verify")).toBeInTheDocument();
      });

      const initialVoteCount = screen.getByText("2");
      const voteButton = screen.getByRole("button", { name: /vote/i });

      await user.click(voteButton);

      // Check optimistic update
      expect(screen.getByText("3")).toBeInTheDocument();

      // Wait for error and rollback
      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument(); // Rolled back
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Button should be enabled again after rollback
      expect(voteButton).not.toBeDisabled();
    });

    it("should handle race conditions with multiple votes", async () => {
      const user = setupUser();
      let voteCount = 2;

      global.fetch = jest.fn((url: string) => {
        if (url.includes("/api/verification/posts") && !url.includes("/vote")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockApiResponses.verification.posts,
          });
        }

        if (url.includes("/vote")) {
          // Simulate server incrementing vote count
          voteCount++;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    message: "Vote recorded",
                    new_vote_count: voteCount,
                  }),
                }),
              100,
            ),
          );
        }
      });

      render(<VerifyPage />);

      await waitFor(() => {
        expect(screen.getByText("Post to Verify")).toBeInTheDocument();
      });

      // Click vote button multiple times quickly
      const voteButton = screen.getByRole("button", { name: /vote/i });
      await user.click(voteButton);
      await user.click(voteButton);
      await user.click(voteButton);

      // Should only make one API call due to debouncing
      await waitFor(() => {
        const voteCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0].includes("/vote"),
        );
        expect(voteCalls).toHaveLength(1);
      });
    });
  });

  describe("Feed Voting", () => {
    it("should update vote count in feed cards", async () => {
      const user = setupUser();
      const post = mockApiResponses.posts.list[0];

      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          data: {
            message: "Vote recorded",
            new_vote_count: 6,
            has_user_voted: true,
          },
        },
      });

      render(<FeedCard post={post} />);

      const voteButton = screen.getByRole("button", { name: /vote/i });
      const voteCount = screen.getByText("5");

      await user.click(voteButton);

      // Check optimistic update
      await waitFor(() => {
        expect(screen.getByText("6")).toBeInTheDocument();
      });

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/posts/1/vote"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      // Button should show voted state
      expect(screen.getByRole("button", { name: /voted/i })).toBeDisabled();
    });

    it("should persist vote state across navigation", async () => {
      const user = setupUser();
      const voteStore = require("@/store/voteStore").useVoteStore;

      // Simulate previous vote
      voteStore.setState({
        voteHistory: new Map([["post-1", true]]),
      });

      const post = {
        ...mockApiResponses.posts.list[0],
        has_user_voted: true,
        vote_count: 6,
      };

      render(<FeedCard post={post} />);

      // Should show voted state
      const voteButton = screen.getByRole("button", { name: /voted/i });
      expect(voteButton).toBeDisabled();
      expect(screen.getByText("6")).toBeInTheDocument();
    });

    it("should sync vote state with WebSocket updates", async () => {
      const post = mockApiResponses.posts.list[0];
      const { rerender } = render(<FeedCard post={post} />);

      expect(screen.getByText("5")).toBeInTheDocument();

      // Simulate WebSocket update
      const updatedPost = {
        ...post,
        vote_count: 10,
        has_user_voted: true,
      };

      rerender(<FeedCard post={updatedPost} />);

      // Should update to new vote count
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /voted/i })).toBeDisabled();
    });
  });

  describe("Vote Synchronization", () => {
    it("should handle offline voting with queue", async () => {
      const user = setupUser();
      const voteStore = require("@/store/voteStore").useVoteStore;

      // Simulate offline
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const post = mockApiResponses.posts.list[0];
      render(<FeedCard post={post} />);

      const voteButton = screen.getByRole("button", { name: /vote/i });
      await user.click(voteButton);

      // Check vote queued
      await waitFor(() => {
        const state = voteStore.getState();
        expect(state.pendingVotes.has("post-1")).toBe(true);
        expect(screen.getByText(/vote pending/i)).toBeInTheDocument();
      });

      // Simulate coming back online
      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          data: {
            message: "Vote recorded",
            new_vote_count: 6,
          },
        },
      });

      // Trigger sync
      await voteStore.getState().syncPendingVotes();

      // Check vote synced
      await waitFor(() => {
        const state = voteStore.getState();
        expect(state.pendingVotes.has("post-1")).toBe(false);
        expect(screen.queryByText(/vote pending/i)).not.toBeInTheDocument();
        expect(screen.getByText("6")).toBeInTheDocument();
      });
    });

    it("should handle vote conflicts", async () => {
      const user = setupUser();

      // User votes optimistically
      const post = mockApiResponses.posts.list[0];

      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          error: {
            detail: "Post already has enough votes",
            current_vote_count: 10,
          },
          status: 409,
        },
      });

      render(<FeedCard post={post} />);

      await user.click(screen.getByRole("button", { name: /vote/i }));

      // Should show conflict resolution
      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument(); // Server count
        expect(
          screen.getByText(/already has enough votes/i),
        ).toBeInTheDocument();
      });
    });
  });
});
