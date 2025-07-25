import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIResponsesView } from "../ai-responses-view";
import { AIResponse } from "@/lib/types";

// Mock the components
jest.mock("../ai-response-card", () => ({
  AIResponseCard: ({ response }: { response: AIResponse }) => (
    <div data-testid={`ai-response-${response.id}`}>
      {response.model_name} - {response.is_successful ? "Success" : "Failed"}
    </div>
  ),
}));

jest.mock("../ai-analysis-progress", () => ({
  AIAnalysisProgress: ({
    postId,
    onComplete,
    onRefresh,
  }: {
    postId: number;
    onComplete: () => void;
    onRefresh?: () => void;
  }) => (
    <div data-testid="ai-analysis-progress">
      <div>Progress for post {postId}</div>
      <button onClick={onComplete}>Complete</button>
      {onRefresh && <button onClick={onRefresh}>Refresh</button>}
    </div>
  ),
}));

// Mock WebSocket hooks
jest.mock("@/lib/hooks/useWebSocket", () => ({
  useWebSocketEvent: jest.fn(
    (
      event: string,
      callback: (data: { postId: number; aiModel: string }) => void,
    ) => {
      const g = global as typeof global & {
        websocketEventHandlers: Record<
          string,
          (data: { postId: number; aiModel: string }) => void
        >;
      };
      if (!g.websocketEventHandlers) {
        g.websocketEventHandlers = {};
      }
      g.websocketEventHandlers[event] = callback;
      return () => {
        delete g.websocketEventHandlers[event];
      };
    },
  ),
}));

// Mock useParams
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
}));

const triggerWebSocketEvent = (
  event: string,
  data: { postId: number; aiModel: string },
) => {
  const g = global as typeof global & {
    websocketEventHandlers?: Record<
      string,
      (data: { postId: number; aiModel: string }) => void
    >;
  };
  const handler = g.websocketEventHandlers?.[event];
  if (handler) {
    handler(data);
  }
};

describe("AIResponsesView with Progress", () => {
  const mockResponses: AIResponse[] = [
    {
      id: 1,
      post_id: 1,
      model_name: "gpt-4",
      response_data: {
        summary: "Test summary",
        historical_context: "Test context",
        future_development: "Test future",
        opinions: "Test opinions",
      },
      response_time_ms: 1200,
      token_count: 500,
      created_at: "2024-01-01T00:00:00Z",
      is_successful: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const g = global as typeof global & {
      websocketEventHandlers: Record<
        string,
        (data: { postId: number; aiModel: string }) => void
      >;
    };
    g.websocketEventHandlers = {};
  });

  it("shows progress component when no responses and analyzing", async () => {
    render(<AIResponsesView responses={[]} postId={1} showProgress={true} />);

    expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();
    expect(screen.getByText("Progress for post 1")).toBeInTheDocument();
  });

  it("shows progress during ongoing analysis", async () => {
    render(
      <AIResponsesView
        responses={mockResponses}
        postId={1}
        showProgress={true}
      />,
    );

    // Trigger analysis started
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "claude-3",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();
    });
  });

  it("hides progress when showProgress is false", () => {
    render(<AIResponsesView responses={[]} postId={1} showProgress={false} />);

    expect(
      screen.queryByTestId("ai-analysis-progress"),
    ).not.toBeInTheDocument();
  });

  it("sets isAnalyzing when trigger analysis is clicked", async () => {
    const user = userEvent.setup();
    const mockOnRefresh = jest.fn();

    render(
      <AIResponsesView
        responses={[]}
        postId={1}
        showProgress={true}
        onRefresh={mockOnRefresh}
      />,
    );

    const triggerButton = screen.getByText("Trigger Analysis");
    await user.click(triggerButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it("handles analysis complete callback", async () => {
    const user = userEvent.setup();
    const mockOnRefresh = jest.fn();

    render(
      <AIResponsesView
        responses={[]}
        postId={1}
        showProgress={true}
        onRefresh={mockOnRefresh}
      />,
    );

    // Progress component is shown when there are no responses
    expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();

    // Start analysis by clicking trigger button
    const triggerButton = screen.getByText("Trigger Analysis");
    await user.click(triggerButton);

    // Simulate analysis started
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    // Progress component should be shown in the main view (not the empty state)
    await waitFor(() => {
      // We're now in the main view with empty responses but progress showing
      expect(screen.getByText("AI Analyses")).toBeInTheDocument();
      expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();
    });

    // Click complete button in progress component
    const completeButton = screen.getByText("Complete");
    await user.click(completeButton);

    // After completion, we should go back to empty state
    await waitFor(() => {
      expect(
        screen.getByText("No AI analyses available yet."),
      ).toBeInTheDocument();
    });
  });

  it("ignores WebSocket events for different postId", async () => {
    render(
      <AIResponsesView
        responses={mockResponses}
        postId={1}
        showProgress={true}
      />,
    );

    // Trigger event for different post
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 2, // Different post
        aiModel: "gpt-4",
      });
    });

    // Should not show progress
    expect(
      screen.queryByTestId("ai-analysis-progress"),
    ).not.toBeInTheDocument();
  });

  it("shows responses and progress together during analysis", async () => {
    render(
      <AIResponsesView
        responses={mockResponses}
        postId={1}
        showProgress={true}
      />,
    );

    // Trigger analysis for new model
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "claude-3",
      });
    });

    await waitFor(() => {
      // Should show both existing responses and progress
      expect(screen.getByTestId("ai-response-1")).toBeInTheDocument();
      expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();
      expect(screen.getByText("1 successful")).toBeInTheDocument();
    });
  });

  it("maintains view mode selection during analysis", async () => {
    const user = userEvent.setup();

    render(
      <AIResponsesView
        responses={mockResponses}
        postId={1}
        showProgress={true}
      />,
    );

    // Find the list view button by its icon
    const buttons = screen.getAllByRole("button");
    const listButton = buttons.find((btn) =>
      btn.querySelector('[class*="lucide-list"]'),
    );

    if (!listButton) {
      throw new Error("List button not found");
    }

    await user.click(listButton);

    // Trigger analysis
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "claude-3",
      });
    });

    // Progress should show and view mode should be maintained
    await waitFor(() => {
      expect(screen.getByTestId("ai-analysis-progress")).toBeInTheDocument();
      // Check that we're still in the view mode by looking for the list layout
      const responseContainer =
        screen.getByTestId("ai-response-1").parentElement;
      expect(responseContainer).toHaveClass("space-y-4"); // List view uses space-y-4
    });
  });

  it("handles refresh callback in progress component", async () => {
    const user = userEvent.setup();
    const mockOnRefresh = jest.fn();

    render(
      <AIResponsesView
        responses={[]}
        postId={1}
        showProgress={true}
        onRefresh={mockOnRefresh}
      />,
    );

    // Find and click refresh in progress component
    const refreshButton = screen.getByText("Refresh");
    await user.click(refreshButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });
});
