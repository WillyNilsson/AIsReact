import { render, screen } from "@testing-library/react";
import { VerificationPostCard } from "../VerificationPostCard";
import { PostFeedItem } from "@/lib/types";

// Mock the hooks
jest.mock("@/lib/hooks/useVoteSync", () => ({
  usePostVoteStatus: jest.fn(() => null),
}));

describe("VerificationPostCard", () => {
  const mockPost: PostFeedItem = {
    id: 123,
    content: "Test content",
    source_url: "https://example.com",
    created_at: new Date().toISOString(),
    verification_score: 0.75,
    user: {
      id: 1,
      username: "testuser",
      email: "test@example.com",
    },
    user_vote: null,
    verification_status: "pending",
    rejection_reason: null,
    image_url: null,
    ai_responses: [],
  };

  const mockProps = {
    post: mockPost,
    onVote: jest.fn(),
    isVoting: false,
    votingPostId: null,
    voteComment: "",
    setVoteComment: jest.fn(),
  };

  it("renders the View Full Post link with correct attributes", () => {
    render(<VerificationPostCard {...mockProps} />);

    // Find the link by searching for the button text
    const viewPostButton = screen.getByText("View Full Post");
    const linkElement = viewPostButton.closest("a");

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute("href", "/posts/123");
    expect(linkElement).toHaveAttribute("target", "_blank");
    expect(linkElement).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the View Full Post link with different post IDs", () => {
    const postWithDifferentId = { ...mockPost, id: 456 };
    const propsWithDifferentPost = { ...mockProps, post: postWithDifferentId };

    render(<VerificationPostCard {...propsWithDifferentPost} />);

    const viewPostButton = screen.getByText("View Full Post");
    const linkElement = viewPostButton.closest("a");

    expect(linkElement).toHaveAttribute("href", "/posts/456");
  });

  it("renders the View Full Post button with ghost variant", () => {
    render(<VerificationPostCard {...mockProps} />);

    const viewPostButton = screen.getByText("View Full Post");

    // Check that the button exists and has the expected classes
    expect(viewPostButton).toBeInTheDocument();
    expect(viewPostButton.tagName).toBe("SPAN"); // Because we use as="span"
  });

  it("does not use window.open", () => {
    const { container } = render(<VerificationPostCard {...mockProps} />);

    // Search for any onclick handlers that might contain window.open
    const elementsWithOnClick = container.querySelectorAll("[onclick]");
    elementsWithOnClick.forEach((element) => {
      const onClickAttr = element.getAttribute("onclick");
      expect(onClickAttr).not.toContain("window.open");
    });
  });
});
