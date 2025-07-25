import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIAnalysisProgress } from "../ai-analysis-progress";

// Define type for global with websocket handlers
interface GlobalWithWebSocketHandlers extends NodeJS.Global {
  websocketEventHandlers?: Record<string, (data: unknown) => void>;
}

// Mock the WebSocket hooks
jest.mock("@/lib/hooks/useWebSocket", () => ({
  useWebSocketEvent: jest.fn(
    (event: string, callback: (data: unknown) => void) => {
      // Store callbacks for triggering in tests
      const globalWithHandlers =
        global as unknown as GlobalWithWebSocketHandlers;
      if (!globalWithHandlers.websocketEventHandlers) {
        globalWithHandlers.websocketEventHandlers = {};
      }
      globalWithHandlers.websocketEventHandlers[event] = callback;

      // Cleanup
      return () => {
        if (globalWithHandlers.websocketEventHandlers) {
          delete globalWithHandlers.websocketEventHandlers[event];
        }
      };
    },
  ),
}));

// Helper to trigger WebSocket events in tests
const triggerWebSocketEvent = (event: string, data: unknown) => {
  const globalWithHandlers = global as unknown as GlobalWithWebSocketHandlers;
  const handler = globalWithHandlers.websocketEventHandlers?.[event];
  if (handler) {
    handler(data);
  }
};

describe("AIAnalysisProgress", () => {
  const mockOnComplete = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const globalWithHandlers = global as unknown as GlobalWithWebSocketHandlers;
    globalWithHandlers.websocketEventHandlers = {};
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders initial pending state for all providers", () => {
    render(
      <AIAnalysisProgress
        postId={1}
        onComplete={mockOnComplete}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByText("AI Analysis Progress")).toBeInTheDocument();
    expect(screen.getByText("0 completed, 0 failed")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    // Check all providers are shown as pending
    expect(screen.getByText("OpenAI GPT-4")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Claude")).toBeInTheDocument();
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("xAI Grok")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
  });

  it("updates provider status when analysis starts", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Analyzing...")).toBeInTheDocument();
      expect(
        screen.getByText("Analyzing with 5 AI models"),
      ).toBeInTheDocument();
    });
  });

  it("updates provider status when analysis completes", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    act(() => {
      triggerWebSocketEvent("ai:analysisCompleted", {
        postId: 1,
        response: {
          model_name: "gpt-4",
          response_time_ms: 1500,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("1500ms")).toBeInTheDocument();
      expect(screen.getByText("1 completed, 0 failed")).toBeInTheDocument();
      expect(screen.getByText("20%")).toBeInTheDocument(); // 1 of 5 completed
    });
  });

  it("handles analysis errors", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "claude-3",
      });
    });

    act(() => {
      triggerWebSocketEvent("ai:analysisError", {
        postId: 1,
        aiModel: "claude-3",
        error: "API rate limit exceeded",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
      expect(screen.getByText("0 completed, 1 failed")).toBeInTheDocument();
    });
  });

  it("handles provider timeout after 30 seconds", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gemini-pro",
      });
    });

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(screen.getByText("Timed out")).toBeInTheDocument();
      expect(screen.getByText("0 completed, 1 failed")).toBeInTheDocument();
    });
  });

  it("handles overall timeout after 2 minutes", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    // Start analysis for all providers
    act(() => {
      ["gpt-4", "claude-3", "gemini-pro", "grok-2", "deepseek-v2"].forEach(
        (model) => {
          triggerWebSocketEvent("ai:analysisStarted", {
            postId: 1,
            aiModel: model,
          });
        },
      );
    });

    // Fast-forward 2 minutes
    act(() => {
      jest.advanceTimersByTime(120000);
    });

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
      // All should be timed out
      const timeoutElements = screen.getAllByText("Timed out");
      expect(timeoutElements).toHaveLength(5);
    });
  });

  it("calls onComplete when all analyses are done", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    const models = ["gpt-4", "claude-3", "gemini-pro", "grok-2", "deepseek-v2"];

    // Start all analyses
    act(() => {
      models.forEach((model) => {
        triggerWebSocketEvent("ai:analysisStarted", {
          postId: 1,
          aiModel: model,
        });
      });
    });

    // Complete all analyses
    act(() => {
      models.forEach((model, index) => {
        triggerWebSocketEvent("ai:analysisCompleted", {
          postId: 1,
          response: {
            model_name: model,
            response_time_ms: 1000 + index * 100,
          },
        });
      });
    });

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
      expect(screen.getByText("5 completed, 0 failed")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  it("shows retry button when analysis fails", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <AIAnalysisProgress
        postId={1}
        onComplete={mockOnComplete}
        onRefresh={mockOnRefresh}
        initialProviders={["gpt-4"]} // Only one provider for simplicity
      />,
    );

    // Simulate a failed analysis
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    act(() => {
      triggerWebSocketEvent("ai:analysisError", {
        postId: 1,
        aiModel: "gpt-4",
        error: "Network error",
      });
    });

    // Wait for completion callback
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });

    // Now retry button should be visible
    await waitFor(() => {
      expect(screen.getByText("Retry Failed")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Retry Failed"));
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it("ignores events for different postId", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 2, // Different post ID
        aiModel: "gpt-4",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Analyzing...")).not.toBeInTheDocument();
      expect(screen.getByText("0 completed, 0 failed")).toBeInTheDocument();
    });
  });

  it("cleans up timeouts on unmount", async () => {
    const { unmount } = render(
      <AIAnalysisProgress postId={1} onComplete={mockOnComplete} />,
    );

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    // Unmount before timeout
    unmount();

    // Fast-forward past timeout
    act(() => {
      jest.advanceTimersByTime(35000);
    });

    // Should not crash or call callbacks
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it("shows elapsed time during analysis", async () => {
    render(<AIAnalysisProgress postId={1} onComplete={mockOnComplete} />);

    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "gpt-4",
      });
    });

    // Check for total time display
    await waitFor(() => {
      expect(screen.getByText("Total time: 0s")).toBeInTheDocument();
    });

    // Fast-forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Force re-render by triggering another event
    act(() => {
      triggerWebSocketEvent("ai:analysisStarted", {
        postId: 1,
        aiModel: "claude-3",
      });
    });

    await waitFor(() => {
      // Check both individual provider time and total time
      expect(screen.getByText("5s")).toBeInTheDocument(); // Individual provider
      expect(screen.getByText("Total time: 5s")).toBeInTheDocument(); // Total time
    });
  });

  it("handles mixed success and failure states", async () => {
    render(
      <AIAnalysisProgress
        postId={1}
        onComplete={mockOnComplete}
        initialProviders={["gpt-4", "claude-3", "gemini-pro"]} // Only test 3 providers
      />,
    );

    // Start all analyses
    act(() => {
      ["gpt-4", "claude-3", "gemini-pro"].forEach((model) => {
        triggerWebSocketEvent("ai:analysisStarted", {
          postId: 1,
          aiModel: model,
        });
      });
    });

    // Complete one successfully
    act(() => {
      triggerWebSocketEvent("ai:analysisCompleted", {
        postId: 1,
        response: {
          model_name: "gpt-4",
          response_time_ms: 1200,
        },
      });
    });

    // Fail one
    act(() => {
      triggerWebSocketEvent("ai:analysisError", {
        postId: 1,
        aiModel: "claude-3",
        error: "Service unavailable",
      });
    });

    // Timeout the third
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(screen.getByText("1 completed, 2 failed")).toBeInTheDocument();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });
});
