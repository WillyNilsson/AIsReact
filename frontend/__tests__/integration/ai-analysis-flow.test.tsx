import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockApiResponses,
  mockAuthStore,
  act,
} from "@/lib/test-utils";
import PostDetailPage from "@/app/posts/[id]/page";
import AIResponsesView from "@/components/ai/ai-responses-view";

const mockPush = jest.fn();

// Mock is already set up in jest.setup.js
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/posts/1",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/posts/1",
  useParams: () => ({ id: "1" }),
}));

describe("AI Analysis Flow Integration", () => {
  const mockPost = {
    id: 1,
    title: "Test Post for AI Analysis",
    content: "This is content that will be analyzed by AI providers",
    author_username: "testuser",
    status: "verified",
    created_at: "2024-01-01T00:00:00Z",
    vote_count: 5,
    ai_responses: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockAuthStore(true, mockApiResponses.login.success.user);
  });

  describe("AI Analysis Trigger", () => {
    it("should trigger analysis when post reaches verification threshold", async () => {
      const user = setupUser();

      // Mock WebSocket for real-time updates
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN,
      };
      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      global.fetch = mockFetch({
        "GET /api/posts/1": { data: mockPost },
        "POST /api/posts/1/analyze": {
          data: {
            message: "AI analysis started",
            task_id: "task-123",
          },
        },
        "GET /api/posts/1/ai-status": {
          data: mockApiResponses.aiAnalysis.inProgress,
        },
      });

      render(<PostDetailPage params={{ id: "1" }} />);

      // Wait for post to load
      await waitFor(() => {
        expect(
          screen.getByText("Test Post for AI Analysis"),
        ).toBeInTheDocument();
      });

      // Find and click analyze button
      const analyzeButton = screen.getByRole("button", {
        name: /start ai analysis/i,
      });
      await user.click(analyzeButton);

      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts/1/analyze"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer mock-jwt-token",
            }),
          }),
        );
      });

      // Should show progress indicators
      expect(screen.getByText(/analysis in progress/i)).toBeInTheDocument();
      expect(screen.getByText(/openai.*processing.*50%/i)).toBeInTheDocument();
      expect(screen.getByText(/anthropic.*pending/i)).toBeInTheDocument();
    });

    it("should poll for analysis updates", async () => {
      jest.useFakeTimers();

      let pollCount = 0;
      global.fetch = jest.fn((url: string) => {
        if (url.includes("/api/posts/1") && !url.includes("ai-status")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockPost,
          });
        }

        if (url.includes("/ai-status")) {
          pollCount++;
          // Return different status on each poll
          const status =
            pollCount === 1
              ? mockApiResponses.aiAnalysis.inProgress
              : mockApiResponses.aiAnalysis.completed;

          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => status,
          });
        }
      });

      render(<AIResponsesView postId={1} />);

      // Initial poll
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Advance timer to trigger next poll
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should show completed state
      await waitFor(() => {
        expect(
          screen.getByText(/openai analysis of the post/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/anthropic analysis of the post/i),
        ).toBeInTheDocument();
      });

      // Should stop polling after completion
      const initialPollCount = pollCount;
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(pollCount).toBe(initialPollCount);

      jest.useRealTimers();
    });

    it("should handle provider failures gracefully", async () => {
      global.fetch = mockFetch({
        "GET /api/posts/1/ai-status": {
          data: {
            ...mockApiResponses.aiAnalysis.completed,
            providers: {
              ...mockApiResponses.aiAnalysis.completed.providers,
              openai: {
                status: "failed",
                error: "Rate limit exceeded",
                timestamp: "2024-01-01T00:00:00Z",
              },
            },
          },
        },
      });

      render(<AIResponsesView postId={1} />);

      await waitFor(() => {
        // Should show error for failed provider
        expect(screen.getByText(/openai.*failed/i)).toBeInTheDocument();
        expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();

        // Should still show successful providers
        expect(
          screen.getByText(/anthropic analysis of the post/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/google analysis of the post/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Real-time Updates", () => {
    it("should receive WebSocket updates for analysis progress", async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN,
      };

      let wsMessageHandler: (event: any) => void;
      mockWebSocket.addEventListener.mockImplementation((event, handler) => {
        if (event === "message") {
          wsMessageHandler = handler;
        }
      });

      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      global.fetch = mockFetch({
        "GET /api/posts/1/ai-status": {
          data: mockApiResponses.aiAnalysis.inProgress,
        },
      });

      render(<AIResponsesView postId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Simulate WebSocket message
      act(() => {
        wsMessageHandler({
          data: JSON.stringify({
            type: "ai_progress",
            post_id: 1,
            provider: "openai",
            status: "completed",
            response: "OpenAI analysis complete",
            timestamp: "2024-01-01T00:01:00Z",
          }),
        });
      });

      // Should update UI with new data
      await waitFor(() => {
        expect(
          screen.getByText(/openai analysis complete/i),
        ).toBeInTheDocument();
      });
    });

    it("should handle WebSocket reconnection", async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.CLOSED,
      };

      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      render(<AIResponsesView postId={1} />);

      // Should show reconnecting state
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });
    });
  });

  describe("AI Response Comparison", () => {
    it("should navigate to comparison view", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "GET /api/posts/1": {
          data: {
            ...mockPost,
            ai_responses: Object.values(
              mockApiResponses.aiAnalysis.completed.providers,
            )
              .filter((p) => p.status === "completed")
              .map((p, i) => ({
                id: i + 1,
                provider: ["openai", "anthropic", "google", "deepseek"][i],
                response: p.response,
                created_at: p.timestamp,
              })),
          },
        },
      });

      render(<PostDetailPage params={{ id: "1" }} />);

      await waitFor(() => {
        expect(
          screen.getByText("Test Post for AI Analysis"),
        ).toBeInTheDocument();
      });

      // Find and click compare button
      const compareButton = screen.getByRole("button", {
        name: /compare responses/i,
      });
      await user.click(compareButton);

      // Should navigate to comparison page
      expect(mockPush).toHaveBeenCalledWith("/posts/1/compare");
    });

    it("should display side-by-side comparison", async () => {
      const mockResponses = [
        {
          id: 1,
          provider: "openai",
          response: "OpenAI thinks this is significant news",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          provider: "anthropic",
          response: "Anthropic analysis shows different perspective",
          created_at: "2024-01-01T00:01:00Z",
        },
      ];

      global.fetch = mockFetch({
        "GET /api/posts/1": {
          data: {
            ...mockPost,
            ai_responses: mockResponses,
          },
        },
      });

      const ComparePage = require("@/app/posts/[id]/compare/page").default;
      render(<ComparePage params={{ id: "1" }} />);

      await waitFor(() => {
        // Should show both responses
        expect(
          screen.getByText(/openai thinks this is significant/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/anthropic analysis shows different/i),
        ).toBeInTheDocument();

        // Should show provider labels
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
        expect(screen.getByText("Anthropic")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle analysis timeout", async () => {
      jest.useFakeTimers();

      global.fetch = mockFetch({
        "GET /api/posts/1/ai-status": {
          data: {
            post_id: 1,
            status: "processing",
            providers: {
              openai: { status: "processing", progress: 50 },
              anthropic: { status: "processing", progress: 30 },
              google: { status: "processing", progress: 20 },
              xai: { status: "processing", progress: 10 },
              deepseek: { status: "processing", progress: 5 },
            },
            started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
          },
        },
      });

      render(<AIResponsesView postId={1} />);

      // Fast forward past timeout threshold (10 minutes)
      await act(async () => {
        jest.advanceTimersByTime(11 * 60 * 1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/analysis timed out/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /retry analysis/i }),
        ).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("should retry failed analysis", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "GET /api/posts/1/ai-status": {
          data: {
            post_id: 1,
            status: "failed",
            error: "All providers failed",
            providers: {
              openai: { status: "failed", error: "API error" },
              anthropic: { status: "failed", error: "Timeout" },
              google: { status: "failed", error: "Rate limit" },
              xai: { status: "failed", error: "Service unavailable" },
              deepseek: { status: "failed", error: "Invalid request" },
            },
          },
        },
        "POST /api/posts/1/analyze": {
          data: {
            message: "AI analysis restarted",
            task_id: "task-456",
          },
        },
      });

      render(<AIResponsesView postId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/all providers failed/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", {
        name: /retry analysis/i,
      });
      await user.click(retryButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts/1/analyze"),
          expect.objectContaining({
            method: "POST",
          }),
        );
      });
    });

    it("should handle partial analysis results", async () => {
      global.fetch = mockFetch({
        "GET /api/posts/1/ai-status": {
          data: {
            post_id: 1,
            status: "partial",
            providers: {
              openai: {
                status: "completed",
                response: "OpenAI analysis",
                timestamp: "2024-01-01T00:00:00Z",
              },
              anthropic: {
                status: "completed",
                response: "Anthropic analysis",
                timestamp: "2024-01-01T00:01:00Z",
              },
              google: { status: "failed", error: "Timeout" },
              xai: { status: "failed", error: "API error" },
              deepseek: { status: "processing", progress: 60 },
            },
          },
        },
      });

      render(<AIResponsesView postId={1} />);

      await waitFor(() => {
        // Should show completed analyses
        expect(screen.getByText(/openai analysis/i)).toBeInTheDocument();
        expect(screen.getByText(/anthropic analysis/i)).toBeInTheDocument();

        // Should show failures
        expect(screen.getByText(/google.*failed/i)).toBeInTheDocument();
        expect(screen.getByText(/xai.*failed/i)).toBeInTheDocument();

        // Should show in-progress
        expect(screen.getByText(/deepseek.*60%/i)).toBeInTheDocument();

        // Should show partial status
        expect(
          screen.getByText(/partial results available/i),
        ).toBeInTheDocument();
      });
    });
  });
});
