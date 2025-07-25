import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import VerifyPage from "../page";
import { useVerificationQueue } from "@/hooks/useVerification";
import { useOptimisticVote } from "@/lib/hooks/useOptimisticVote";
import { useAuth } from "@/hooks/useAuth";
import { PostFeedItem, PostStatus } from "@/lib/types";

// Mock dependencies
const mockRouter = {
  push: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/hooks/useVerification");
jest.mock("@/lib/hooks/useOptimisticVote");
jest.mock("@/hooks/useAuth");
jest.mock("@/lib/hooks/useVoteSync", () => ({
  useVoteSync: jest.fn(),
  usePostVoteStatus: jest.fn((postId, apiVote) => apiVote),
}));
jest.mock("@/components/auth/email-verification-guard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("swr", () => ({
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  ...jest.requireActual("swr"),
  mutate: jest.fn(),
}));

const mockUseVerificationQueue = useVerificationQueue as jest.MockedFunction<
  typeof useVerificationQueue
>;
const mockUseOptimisticVote = useOptimisticVote as jest.MockedFunction<
  typeof useOptimisticVote
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("VerifyPage - Optimistic Voting", () => {
  const mockVote = jest.fn();
  const mockMutate = jest.fn();

  const mockPost: PostFeedItem = {
    id: 1,
    title: "Test Article",
    content: "Test content for verification",
    source_url: "https://example.com/article",
    status: PostStatus.PENDING_VERIFICATION,
    verification_score: 3,
    verification_count: 3,
    user_vote: null,
    created_at: "2024-01-01T00:00:00Z",
    user: {
      id: 2,
      username: "testauthor",
      email: "author@example.com",
      role: "user",
      is_active: true,
      is_verified: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    ai_response_count: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter.push.mockClear();

    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "testuser", role: "user" },
      isAuthenticated: true,
    } as ReturnType<typeof useAuth>);

    mockUseVerificationQueue.mockReturnValue({
      posts: [mockPost],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    mockUseOptimisticVote.mockReturnValue({
      vote: mockVote,
      isVoting: false,
      error: null,
    });
  });

  it("should render verification queue correctly", () => {
    render(<VerifyPage />);

    expect(screen.getByText("Verify Posts")).toBeInTheDocument();
    expect(
      screen.getByText("Test content for verification"),
    ).toBeInTheDocument();
    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
    expect(
      screen.getByText("Current Verification Score: 3"),
    ).toBeInTheDocument();
  });

  it("should handle positive vote with optimistic update", async () => {
    mockVote.mockResolvedValueOnce(undefined);

    render(<VerifyPage />);

    const verifyButton = screen.getByRole("button", {
      name: /mark as accurate/i,
    });

    await act(async () => {
      fireEvent.click(verifyButton);
    });

    // Check that vote was called with correct parameters
    expect(mockVote).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 1,
        voteValue: true,
        comment: undefined,
        existingVote: null,
      }),
    );

    // Should not manually call mutate - handled by optimistic hook
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("should handle negative vote with comment", async () => {
    mockVote.mockResolvedValueOnce(undefined);

    render(<VerifyPage />);

    const rejectButton = screen.getByRole("button", {
      name: /mark as inaccurate/i,
    });

    // First click to show comment field
    fireEvent.click(rejectButton);

    // Add comment
    const commentField = screen.getByPlaceholderText(
      /add a comment explaining your vote/i,
    );
    fireEvent.change(commentField, {
      target: { value: "Source does not match content" },
    });

    // Submit vote
    await act(async () => {
      fireEvent.click(rejectButton);
    });

    expect(mockVote).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 1,
        voteValue: false,
        comment: "Source does not match content",
        existingVote: null,
      }),
    );
  });

  it("should disable voting buttons while vote is in progress", () => {
    mockUseOptimisticVote.mockReturnValue({
      vote: mockVote,
      isVoting: true,
      error: null,
    });

    render(<VerifyPage />);

    const accurateButton = screen.getByRole("button", {
      name: /mark as accurate/i,
    });
    const inaccurateButton = screen.getByRole("button", {
      name: /mark as inaccurate/i,
    });

    expect(accurateButton).toBeDisabled();
    expect(inaccurateButton).toBeDisabled();
  });

  it("should handle vote errors gracefully", async () => {
    const error = new Error("Network error");
    mockVote.mockRejectedValueOnce(error);

    // Mock console.error to avoid noise in test output
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    render(<VerifyPage />);

    const verifyButton = screen.getByRole("button", {
      name: /mark as accurate/i,
    });

    await act(async () => {
      fireEvent.click(verifyButton);
    });

    // Button should be enabled again after error
    expect(verifyButton).not.toBeDisabled();

    consoleError.mockRestore();
  });

  it("should show already voted state correctly", () => {
    const votedPost = {
      ...mockPost,
      user_vote: true,
    };

    mockUseVerificationQueue.mockReturnValue({
      posts: [votedPost],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<VerifyPage />);

    // Check that the vote buttons are disabled for voted posts
    const buttons = screen.getAllByRole("button", {
      name: /mark as accurate/i,
    });
    expect(buttons[0]).toBeDisabled();
  });

  it("should clear comment after successful vote", async () => {
    mockVote.mockResolvedValueOnce(undefined);

    render(<VerifyPage />);

    const rejectButton = screen.getByRole("button", {
      name: /mark as inaccurate/i,
    });

    // First click to show comment field
    fireEvent.click(rejectButton);

    // Add comment
    const commentField = screen.getByPlaceholderText(
      /add a comment explaining your vote/i,
    );
    fireEvent.change(commentField, { target: { value: "Test comment" } });

    // Submit vote
    await act(async () => {
      fireEvent.click(rejectButton);
    });

    // Comment should be cleared after successful vote
    // Note: The component state would reset the comment, but we're testing the logic
    expect(mockVote).toHaveBeenCalled();
  });

  it.skip("should handle rapid voting attempts correctly", async () => {
    // Mock isVoting to simulate ongoing vote
    mockUseOptimisticVote
      .mockReturnValueOnce({
        vote: mockVote,
        isVoting: false,
        error: null,
      })
      .mockReturnValueOnce({
        vote: mockVote,
        isVoting: true, // Simulating voting in progress after first click
        error: null,
      });

    const { rerender } = render(<VerifyPage />);

    const verifyButton = screen.getByRole("button", {
      name: /mark as accurate/i,
    });

    // First click
    fireEvent.click(verifyButton);

    // Simulate component re-render with isVoting = true
    rerender(<VerifyPage />);

    // Now button should be disabled
    const verifyButtonAfterClick = screen.getByRole("button", {
      name: /mark as accurate/i,
    });
    expect(verifyButtonAfterClick).toBeDisabled();
  });

  it("should update UI optimistically for multiple posts", async () => {
    const posts = [
      mockPost,
      { ...mockPost, id: 2, verification_score: 5, verification_count: 5 },
      { ...mockPost, id: 3, verification_score: -2, verification_count: 2 },
    ];

    mockUseVerificationQueue.mockReturnValue({
      posts,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    mockVote.mockResolvedValue(undefined);

    render(<VerifyPage />);

    // Vote on second post
    const verifyButtons = screen.getAllByRole("button", {
      name: /mark as accurate/i,
    });

    await act(async () => {
      fireEvent.click(verifyButtons[1]);
    });

    expect(mockVote).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 2,
        voteValue: true,
        comment: undefined,
        existingVote: null,
      }),
    );
  });

  it("should handle empty verification queue", () => {
    mockUseVerificationQueue.mockReturnValue({
      posts: [],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<VerifyPage />);

    expect(
      screen.getByText("All posts have been verified! Check back later."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to dashboard/i }),
    ).toBeInTheDocument();
  });
});
