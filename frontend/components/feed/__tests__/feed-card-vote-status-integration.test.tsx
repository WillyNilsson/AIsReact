import React from "react";
import { render, screen } from "@testing-library/react";
import { FeedCardWithImage as FeedCard } from "../feed-card-with-image";
import { PostFeedItem, PostStatus } from "@/lib/types";

// Mock dependencies
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/lib/hooks/useVoteSync", () => ({
  usePostVoteStatus: (postId: number, initialVote: boolean | null) =>
    initialVote,
}));

// Mock the VoteStatus component to verify it's being used
jest.mock("@/components/ui/vote-status", () => ({
  VoteStatus: ({
    userVote,
    className,
  }: {
    userVote: boolean | null;
    className?: string;
  }) => (
    <div
      data-testid="vote-status"
      data-user-vote={userVote}
      className={className}
    >
      {userVote === true && "Voted Accurate"}
      {userVote === false && "Voted Inaccurate"}
    </div>
  ),
}));

describe("FeedCard VoteStatus Integration", () => {
  const mockPost: PostFeedItem = {
    id: 1,
    title: "Test Post",
    content: "Test content",
    source_url: "https://example.com",
    status: PostStatus.LIVE,
    created_at: new Date().toISOString(),
    verification_score: 5,
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
    ai_response_count: 0,
    verification_count: 5,
  };

  it("renders VoteStatus component when user has voted positively", () => {
    const votedPost = { ...mockPost, user_vote: true };

    render(<FeedCard post={votedPost} />);

    const voteStatus = screen.getByTestId("vote-status");
    expect(voteStatus).toBeInTheDocument();
    expect(voteStatus).toHaveAttribute("data-user-vote", "true");
    expect(screen.getByText("Voted Accurate")).toBeInTheDocument();
  });

  it("renders VoteStatus component when user has voted negatively", () => {
    const votedPost = { ...mockPost, user_vote: false };

    render(<FeedCard post={votedPost} />);

    const voteStatus = screen.getByTestId("vote-status");
    expect(voteStatus).toBeInTheDocument();
    expect(voteStatus).toHaveAttribute("data-user-vote", "false");
    expect(screen.getByText("Voted Inaccurate")).toBeInTheDocument();
  });

  it("does not render VoteStatus when user has not voted", () => {
    const unvotedPost = { ...mockPost, user_vote: null };

    render(<FeedCard post={unvotedPost} />);

    expect(screen.queryByTestId("vote-status")).not.toBeInTheDocument();
  });

  it("applies correct positioning and styling to VoteStatus", () => {
    const votedPost = { ...mockPost, user_vote: true };

    render(<FeedCard post={votedPost} />);

    const voteStatus = screen.getByTestId("vote-status");
    expect(voteStatus).toHaveClass("text-xs", "px-2", "py-1");
  });

  it("shows VoteStatus in absolute position at top right", () => {
    const votedPost = { ...mockPost, user_vote: true };

    render(<FeedCard post={votedPost} />);

    const voteStatusContainer = screen.getByTestId("vote-status").parentElement;
    expect(voteStatusContainer).toHaveClass("absolute", "top-2", "right-2");
  });
});
