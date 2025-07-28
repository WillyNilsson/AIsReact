import React from "react";
import { render, screen, act } from "@testing-library/react";
import { AIResponsesView } from "@/components/ai/ai-responses-view";
import { useWebSocketEvent } from "@/lib/hooks/useWebSocket";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
}));

jest.mock("@/lib/hooks/useWebSocket", () => ({
  useWebSocketEvent: jest.fn(),
}));

// Mock the AIAnalysisProgress component to verify it receives correct props
jest.mock("@/components/ai/ai-analysis-progress", () => ({
  AIAnalysisProgress: ({
    postId,
    onComplete,
    onRefresh,
  }: {
    postId: number;
    onComplete: () => void;
    onRefresh?: () => void;
  }) => (
    <div data-testid="ai-analysis-progress" data-post-id={postId}>
      <button onClick={onComplete}>Complete</button>
      {onRefresh && <button onClick={onRefresh}>Refresh</button>}
    </div>
  ),
}));

describe("AIResponsesView Integration with AIAnalysisProgress", () => {
  let mockWebSocketCallbacks: Record<string, (data: unknown) => void> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocketCallbacks = {};

    (useWebSocketEvent as jest.Mock).mockImplementation(
      (event: string, callback: (data: unknown) => void) => {
        mockWebSocketCallbacks[event] = callback;
      },
    );
  });

  it("shows AIAnalysisProgress when analysis starts via WebSocket", async () => {
    const { rerender } = render(<AIResponsesView responses={[]} postId={1} />);

    // Initially no progress shown
    expect(
      screen.queryByTestId("ai-analysis-progress"),
    ).not.toBeInTheDocument();

    // Simulate WebSocket event for analysis started
    act(() => {
      mockWebSocketCallbacks["ai:analysisStarted"]({ postId: 1 });
    });

    // Re-render to see the state change
    rerender(<AIResponsesView responses={[]} postId={1} />);

    // Progress should now be shown
    const progress = screen.getByTestId("ai-analysis-progress");
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute("data-post-id", "1");
  });

  it("hides AIAnalysisProgress when onComplete is called", async () => {
    const { rerender } = render(<AIResponsesView responses={[]} postId={1} />);

    // Start analysis
    act(() => {
      mockWebSocketCallbacks["ai:analysisStarted"]({ postId: 1 });
    });

    rerender(<AIResponsesView responses={[]} postId={1} />);

    expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();

    // Click complete button (which calls onComplete)
    const completeButton = screen.getByText("Complete");
    act(() => {
      completeButton.click();
    });

    rerender(<AIResponsesView responses={[]} postId={1} />);

    // Progress should be hidden
    expect(
      screen.queryByTestId("ai-analysis-progress"),
    ).not.toBeInTheDocument();
  });

  it("passes onRefresh prop to AIAnalysisProgress", () => {
    const onRefresh = jest.fn();

    render(<AIResponsesView responses={[]} postId={1} isLoading={false} />);

    // When no responses and not analyzing, should show progress with refresh
    const refreshButton = screen.getByText("Refresh");
    expect(refreshButton).toBeInTheDocument();

    act(() => {
      refreshButton.click();
    });

    expect(onRefresh).toHaveBeenCalled();
  });

  it("only shows progress for matching postId", () => {
    const { rerender } = render(<AIResponsesView responses={[]} postId={1} />);

    // Simulate WebSocket event for different post
    act(() => {
      mockWebSocketCallbacks["ai:analysisStarted"]({ postId: 2 });
    });

    rerender(<AIResponsesView responses={[]} postId={1} />);

    // Progress should not be shown for different post
    expect(
      screen.queryByTestId("ai-analysis-progress"),
    ).not.toBeInTheDocument();
  });

  it("shows progress during analysis and hides when responses arrive", () => {
    const { rerender } = render(<AIResponsesView responses={[]} postId={1} />);

    // Start analysis
    act(() => {
      mockWebSocketCallbacks["ai:analysisStarted"]({ postId: 1 });
    });

    rerender(<AIResponsesView responses={[]} postId={1} />);

    expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();

    // Now provide responses
    const mockResponses = [
      {
        id: 1,
        post_id: 1,
        model_name: "gpt-4",
        is_successful: true,
        response_data: {
          summary: "Test",
          historical_context: "Test context",
          future_development: "Test development",
          opinions: "Test opinions",
        },
        created_at: new Date().toISOString(),
      },
    ];

    rerender(<AIResponsesView responses={mockResponses} postId={1} />);

    // Progress should still show if isAnalyzing is true
    // But responses should also be displayed
    expect(screen.getByText("AI Analyses")).toBeInTheDocument();
  });
});
