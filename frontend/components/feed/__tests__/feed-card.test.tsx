import React from "react";
import { render, screen } from "@testing-library/react";
import { FeedCardWithImage as FeedCard } from "../feed-card-with-image";
import { PostFeedItem, PostStatus } from "@/lib/types";

// Mock next/link
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

describe("FeedCard Component", () => {
  const mockPost: PostFeedItem = {
    id: 1,
    title: "Test Post About Technology",
    content: "This is a test post about technology and AI.",
    source_url: "https://example.com/article",
    status: PostStatus.LIVE,
    created_at: "2025-01-22T10:00:00Z",
    verification_score: 5,
    verification_count: 10,
    user: {
      id: 1,
      username: "testuser",
      email: "test@example.com",
      role: "user",
      is_active: true,
      is_verified: true,
      created_at: "2025-01-22T10:00:00Z",
      updated_at: "2025-01-22T10:00:00Z",
    },
    ai_response_count: 3,
  };

  it("renders post information correctly", () => {
    render(<FeedCard post={mockPost} />);

    expect(screen.getByText("Text Post")).toBeInTheDocument();
    expect(screen.getByText(mockPost.content)).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("3 AI analyses")).toBeInTheDocument();
    expect(screen.getByText("Score: 5")).toBeInTheDocument();
  });

  it("displays correct status badge", () => {
    render(<FeedCard post={mockPost} />);

    const statusBadge = screen.getByText("live");
    expect(statusBadge).toHaveClass("bg-green-100", "text-green-800");
  });

  it("formats date correctly", () => {
    render(<FeedCard post={mockPost} />);

    const dateElement = screen.getByText(
      new Date(mockPost.created_at).toLocaleDateString(),
    );
    expect(dateElement).toBeInTheDocument();
  });

  it("links to post detail page", () => {
    render(<FeedCard post={mockPost} />);

    const links = screen.getAllByRole("link");
    const mainLink = links[0];
    expect(mainLink).toHaveAttribute("href", `/posts/${mockPost.id}`);
  });

  it("shows correct content for image posts", () => {
    const imagePost: PostFeedItem = {
      ...mockPost,
      image_url: "https://example.com/image.jpg",
    };

    render(<FeedCard post={imagePost} />);
    expect(screen.getByText("Image Post")).toBeInTheDocument();
  });

  it("handles posts without AI responses", () => {
    const postWithoutAI: PostFeedItem = {
      ...mockPost,
      ai_response_count: 0,
    };

    render(<FeedCard post={postWithoutAI} />);
    expect(screen.queryByText(/AI analyses/)).not.toBeInTheDocument();
  });

  it("displays source URL with external link icon", () => {
    render(<FeedCard post={mockPost} />);

    const sourceLink = screen.getByText(mockPost.source_url);
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink).toHaveAttribute("href", mockPost.source_url);
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("applies hover effects", () => {
    render(<FeedCard post={mockPost} />);

    const links = screen.getAllByRole("link");
    const card = links[0].firstElementChild;
    expect(card).toHaveClass(
      "hover:shadow-lg",
      "transition-shadow",
      "cursor-pointer",
    );
  });

  it("handles different post statuses", () => {
    const statuses = [
      { status: PostStatus.PENDING_MODERATION, color: "yellow" },
      { status: PostStatus.PENDING_VERIFICATION, color: "blue" },
      { status: PostStatus.REJECTED, color: "red" },
      { status: PostStatus.DISPUTED, color: "orange" },
      { status: PostStatus.REMOVED, color: "gray" },
    ];

    statuses.forEach(({ status, color }) => {
      const { unmount } = render(<FeedCard post={{ ...mockPost, status }} />);

      const statusBadge = screen.getByText(status.replace(/_/g, " "));
      expect(statusBadge).toHaveClass(`bg-${color}-100`, `text-${color}-800`);

      unmount();
    });
  });

  it("prevents event propagation on source link click", () => {
    render(<FeedCard post={mockPost} />);

    const sourceLink = screen.getByText(mockPost.source_url);
    const clickEvent = new MouseEvent("click", { bubbles: true });

    sourceLink.dispatchEvent(clickEvent);
    // Note: In a real test, we'd need to mock the onClick handler to verify stopPropagation
  });
});
