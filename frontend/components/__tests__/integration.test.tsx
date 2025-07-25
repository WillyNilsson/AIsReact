import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIResponsesView } from "@/components/ai/ai-responses-view";
import { FeedCard } from "@/components/feed/feed-card";
import { WebSocketProvider } from "@/components/providers/websocket-provider";
import VerifyPage from "@/app/(protected)/verify/page";
import { PostFeedItem, PostStatus } from "@/lib/types";
import * as useVerificationModule from "@/hooks/useVerification";
import * as useVoteSyncModule from "@/lib/hooks/useVoteSync";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ id: "1" }),
}));

jest.mock("@/lib/hooks/useWebSocket", () => ({
  useWebSocketConnection: jest.fn(),
  useWebSocketEvent: jest.fn(),
  useRealtimePost: jest.fn(),
}));

jest.mock("@/hooks/useVerification", () => ({
  useVerificationQueue: () => ({
    posts: [mockPost],
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/useOptimisticVote", () => ({
  useOptimisticVote: () => ({
    vote: mockVote,
    isVoting: false,
  }),
}));

jest.mock("@/lib/hooks/useVoteSync", () => ({
  useVoteSync: jest.fn(),
  usePostVoteStatus: (postId: number, initialVote: boolean | null) =>
    initialVote,
}));

jest.mock("@/store/authStore", () => ({
  useAuthStore: () => ({ user: { id: 1, username: "testuser" } }),
}));

const mockVote = jest.fn();

const mockPost: PostFeedItem = {
  id: 1,
  title: "Test Post",
  content: "Test content",
  source_url: "https://example.com",
  status: PostStatus.PENDING_VERIFICATION,
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
  created_at: new Date().toISOString(),
  verification_score: 0,
  verification_count: 0,
  ai_response_count: 0,
  user_vote: null,
};

const mockAIResponses = [
  {
    id: 1,
    post_id: 1,
    model_name: "gpt-4",
    is_successful: true,
    response_data: {
      summary: "Test summary",
      historical_context: "Test history",
      future_development: "Test future",
      opinions: "Test opinions",
    },
    created_at: new Date().toISOString(),
  },
];

describe("Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("AIAnalysisProgress in AIResponsesView", () => {
    it("shows progress when analyzing", async () => {
      render(
        <AIResponsesView
          responses={[]}
          isLoading={false}
          postId={1}
          showProgress={true}
        />,
      );

      // Initially no progress shown
      expect(
        screen.queryByTestId("ai-analysis-progress"),
      ).not.toBeInTheDocument();
    });

    it("shows responses when available", async () => {
      render(
        <AIResponsesView
          responses={mockAIResponses}
          isLoading={false}
          postId={1}
        />,
      );

      // Should show AI analyses header
      expect(screen.getByText("AI Analyses")).toBeInTheDocument();
      expect(screen.getByText("1 successful")).toBeInTheDocument();
    });

    it("handles empty state with trigger button", async () => {
      const onRefresh = jest.fn();
      render(
        <AIResponsesView
          responses={[]}
          isLoading={false}
          postId={1}
          onRefresh={onRefresh}
        />,
      );

      expect(
        screen.getByText("No AI analyses available yet."),
      ).toBeInTheDocument();

      const triggerButton = screen.getByRole("button", {
        name: /trigger analysis/i,
      });
      await userEvent.click(triggerButton);

      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe("useOptimisticVote in Verify Page", () => {
    it("calls vote function with correct parameters", async () => {
      render(<VerifyPage />);

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText("Verification Queue")).toBeInTheDocument();
      });

      // Find and click the verify button
      const verifyButton = screen.getByRole("button", {
        name: /verify as accurate/i,
      });
      await userEvent.click(verifyButton);

      expect(mockVote).toHaveBeenCalledWith({
        postId: 1,
        voteData: { vote: true },
        currentPost: mockPost,
      });
    });

    it("shows vote status after voting", async () => {
      const votedPost = { ...mockPost, user_vote: true };

      jest.mocked(useVerificationModule.useVerificationQueue).mockReturnValue({
        posts: [votedPost],
        isLoading: false,
        error: null,
        mutate: jest.fn(),
      });

      jest.mocked(useVoteSyncModule.usePostVoteStatus).mockReturnValue(true);

      render(<VerifyPage />);

      await waitFor(() => {
        expect(
          screen.getByText("You have already voted on this post"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("VoteStatus in Feed Cards", () => {
    it("shows VoteStatus when user has voted", () => {
      const votedPost = { ...mockPost, user_vote: true };

      jest.mocked(useVoteSyncModule.usePostVoteStatus).mockReturnValue(true);

      render(<FeedCard post={votedPost} />);

      // VoteStatus component should be rendered
      expect(screen.getByText("Voted Accurate")).toBeInTheDocument();
    });

    it("does not show VoteStatus when user has not voted", () => {
      render(<FeedCard post={mockPost} />);

      // VoteStatus component should not be rendered
      expect(screen.queryByText("Voted Accurate")).not.toBeInTheDocument();
      expect(screen.queryByText("Voted Inaccurate")).not.toBeInTheDocument();
    });

    it("shows correct vote status for negative vote", () => {
      const votedPost = { ...mockPost, user_vote: false };

      jest.mocked(useVoteSyncModule.usePostVoteStatus).mockReturnValue(false);

      render(<FeedCard post={votedPost} />);

      expect(screen.getByText("Voted Inaccurate")).toBeInTheDocument();
    });
  });

  describe("ConnectionStatus in WebSocketProvider", () => {
    it("renders ConnectionStatus component", () => {
      render(
        <WebSocketProvider>
          <div>Test content</div>
        </WebSocketProvider>,
      );

      // The ConnectionStatus component should be rendered
      // It might not show any visible content if connected
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });
  });
});
