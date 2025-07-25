import React from "react";
import { render, screen } from "@testing-library/react";
import { FeedCard } from "../feed-card";
import { PostFeedItem, PostStatus } from "@/lib/types";
import { usePostVoteStatus } from "@/lib/hooks/useVoteSync";

// Mock dependencies
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

jest.mock("@/lib/hooks/useVoteSync");
jest.mock("@/lib/utils/date", () => ({
  safeLocaleDateString: (date: string) => date,
}));

const mockPost: PostFeedItem = {
  id: 1,
  user: {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    role: "user",
    is_active: true,
    is_verified: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  title: "Test Post",
  content: "Test content",
  source_url: "https://example.com",
  status: PostStatus.LIVE,
  created_at: "2024-01-01T00:00:00Z",
  verification_score: 5,
  verification_count: 10,
  ai_response_count: 3,
};

describe("FeedCard Vote Indicators", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show vote indicator when user has voted accurate", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(true);

    render(<FeedCard post={{ ...mockPost, user_vote: true }} />);

    expect(screen.getByText("Voted Accurate")).toBeInTheDocument();
  });

  it("should show vote indicator when user has voted inaccurate", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(false);

    render(<FeedCard post={{ ...mockPost, user_vote: false }} />);

    expect(screen.getByText("Voted Inaccurate")).toBeInTheDocument();
  });

  it("should not show vote indicator when user has not voted", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(null);

    render(<FeedCard post={mockPost} />);

    expect(screen.queryByText("Voted Accurate")).not.toBeInTheDocument();
    expect(screen.queryByText("Voted Inaccurate")).not.toBeInTheDocument();
  });

  it("should apply border style when user has voted", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(true);

    const { container } = render(
      <FeedCard post={{ ...mockPost, user_vote: true }} />,
    );

    const card = container.querySelector(".border-blue-500");
    expect(card).toBeInTheDocument();
  });

  it("should not apply border style when user has not voted", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(null);

    const { container } = render(<FeedCard post={mockPost} />);

    const card = container.querySelector(".border-blue-500");
    expect(card).not.toBeInTheDocument();
  });

  it("should use local vote when API vote is not available", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(true);

    render(<FeedCard post={{ ...mockPost, user_vote: null }} />);

    expect(usePostVoteStatus).toHaveBeenCalledWith(1, null);
    expect(screen.getByText("Voted Accurate")).toBeInTheDocument();
  });

  it("should position vote indicator correctly", () => {
    (usePostVoteStatus as jest.Mock).mockReturnValue(true);

    render(<FeedCard post={{ ...mockPost, user_vote: true }} />);

    const voteIndicator = screen.getByText("Voted Accurate").parentElement;
    expect(voteIndicator?.parentElement).toHaveClass(
      "absolute",
      "top-2",
      "right-2",
    );
  });
});
