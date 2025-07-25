import React from "react";
import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockApiResponses,
  mockAuthStore,
} from "@/lib/test-utils";
import { WebSocketProvider } from "@/components/providers/websocket-provider";
import FeedCard from "@/components/feed/feed-card";
import { act } from "@testing-library/react";

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 0;

    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent("message", { data: JSON.stringify(data) }),
      );
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

let mockWebSocket: MockWebSocket | null = null;

// Mock WebSocket globally
global.WebSocket = jest.fn().mockImplementation((url: string) => {
  mockWebSocket = new MockWebSocket(url);
  return mockWebSocket;
}) as any;

describe("WebSocket Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore(true, mockApiResponses.login.success.user);
    mockWebSocket = null;
  });

  afterEach(() => {
    if (mockWebSocket) {
      mockWebSocket.close();
    }
  });

  describe("Real-time Vote Updates", () => {
    it("should update vote count in real-time when receiving WebSocket message", async () => {
      const post = mockApiResponses.posts.list[0];

      render(
        <WebSocketProvider>
          <FeedCard post={post} />
        </WebSocketProvider>,
      );

      // Initial vote count
      expect(screen.getByText(/5 votes/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /vote/i })).not.toBeDisabled();

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Simulate vote update from WebSocket
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "vote_update",
          post_id: post.id,
          vote_count: 10,
          user_has_voted: true,
        });
      });

      // Check updated UI
      await waitFor(() => {
        expect(screen.getByText(/10 votes/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /voted/i })).toBeDisabled();
      });
    });

    it("should handle WebSocket reconnection gracefully", async () => {
      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for initial connection
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Simulate disconnect
      act(() => {
        mockWebSocket?.close();
      });

      // Should show connection status
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });

      // Simulate reconnection
      act(() => {
        // Create new WebSocket instance
        const newWs = new MockWebSocket("ws://localhost:8000/ws");
        mockWebSocket = newWs;
        global.WebSocket = jest.fn().mockReturnValue(newWs) as any;

        // Trigger reconnect by simulating timer
        jest.advanceTimersByTime(5000);
      });

      // Should reconnect
      await waitFor(() => {
        expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
      });
    });

    it("should queue messages during disconnection and process on reconnect", async () => {
      const user = setupUser();
      const post = mockApiResponses.posts.list[0];

      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          data: mockApiResponses.verification.vote.success,
        },
      });

      render(
        <WebSocketProvider>
          <FeedCard post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket to be created
      await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
      });

      // Disconnect WebSocket
      act(() => {
        mockWebSocket?.close();
      });

      // Vote while disconnected
      const voteButton = screen.getByRole("button", { name: /vote/i });
      await user.click(voteButton);

      // Should show optimistic update
      expect(screen.getByText(/6 votes/i)).toBeInTheDocument();

      // Reconnect
      act(() => {
        const newWs = new MockWebSocket("ws://localhost:8000/ws");
        mockWebSocket = newWs;
        global.WebSocket = jest.fn().mockReturnValue(newWs) as any;
      });

      // Should sync state after reconnection
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts/1/vote"),
          expect.any(Object),
        );
      });
    });
  });

  describe("Real-time AI Analysis Updates", () => {
    it("should show AI analysis progress in real-time", async () => {
      const post = { ...mockApiResponses.posts.list[0], status: "analyzing" };

      render(
        <WebSocketProvider>
          <FeedCard post={post} />
        </WebSocketProvider>,
      );

      // Should show analyzing status
      expect(screen.getByText(/AI Analysis in Progress/i)).toBeInTheDocument();

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Simulate progress update
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "ai_analysis_progress",
          post_id: post.id,
          providers: {
            openai: { status: "completed", progress: 100 },
            anthropic: { status: "processing", progress: 50 },
            google: { status: "pending", progress: 0 },
            xai: { status: "pending", progress: 0 },
            deepseek: { status: "pending", progress: 0 },
          },
        });
      });

      // Should update progress display
      await waitFor(() => {
        expect(screen.getByText(/OpenAI: Complete/i)).toBeInTheDocument();
        expect(screen.getByText(/Anthropic: 50%/i)).toBeInTheDocument();
      });

      // Simulate completion
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "ai_analysis_complete",
          post_id: post.id,
          status: "verified",
        });
      });

      // Should show completion
      await waitFor(() => {
        expect(
          screen.queryByText(/AI Analysis in Progress/i),
        ).not.toBeInTheDocument();
        expect(screen.getByText(/View AI Responses/i)).toBeInTheDocument();
      });
    });

    it("should handle AI analysis errors gracefully", async () => {
      const post = { ...mockApiResponses.posts.list[0], status: "analyzing" };

      render(
        <WebSocketProvider>
          <FeedCard post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Simulate error
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "ai_analysis_error",
          post_id: post.id,
          error: "All AI providers failed",
          providers: {
            openai: { status: "failed", error: "Rate limit exceeded" },
            anthropic: { status: "failed", error: "Timeout" },
            google: { status: "failed", error: "Service unavailable" },
            xai: { status: "failed", error: "Invalid API key" },
            deepseek: { status: "failed", error: "Network error" },
          },
        });
      });

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/AI Analysis Failed/i)).toBeInTheDocument();
        expect(
          screen.getByText(/All AI providers failed/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Multiple Component Synchronization", () => {
    it("should update multiple components showing same post", async () => {
      const post = mockApiResponses.posts.list[0];

      render(
        <WebSocketProvider>
          <div>
            <FeedCard post={post} />
            <FeedCard post={post} />
          </div>
        </WebSocketProvider>,
      );

      // Both should show initial state
      const voteButtons = screen.getAllByRole("button", { name: /vote/i });
      expect(voteButtons).toHaveLength(2);
      expect(screen.getAllByText(/5 votes/i)).toHaveLength(2);

      // Wait for WebSocket
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Simulate vote update
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "vote_update",
          post_id: post.id,
          vote_count: 8,
          user_has_voted: false,
        });
      });

      // Both components should update
      await waitFor(() => {
        expect(screen.getAllByText(/8 votes/i)).toHaveLength(2);
      });
    });

    it("should handle rapid WebSocket messages without race conditions", async () => {
      const post = mockApiResponses.posts.list[0];

      render(
        <WebSocketProvider>
          <FeedCard post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      });

      // Send rapid updates
      act(() => {
        for (let i = 6; i <= 15; i++) {
          mockWebSocket?.simulateMessage({
            type: "vote_update",
            post_id: post.id,
            vote_count: i,
            user_has_voted: false,
          });
        }
      });

      // Should show final state
      await waitFor(() => {
        expect(screen.getByText(/15 votes/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Recovery", () => {
    it("should reconnect with exponential backoff on connection failure", async () => {
      jest.useFakeTimers();

      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByText("Test Content")).toBeInTheDocument();
      });

      // Simulate multiple failures
      const reconnectAttempts: number[] = [];

      global.WebSocket = jest.fn().mockImplementation(() => {
        reconnectAttempts.push(Date.now());
        const ws = new MockWebSocket("ws://localhost:8000/ws");
        // Fail immediately
        setTimeout(() => ws.simulateError(), 5);
        return ws;
      }) as any;

      // First failure
      act(() => {
        mockWebSocket?.simulateError();
        mockWebSocket?.close();
      });

      // Should show reconnecting status
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });

      // Should retry with backoff
      act(() => {
        jest.advanceTimersByTime(1000); // First retry at 1s
      });

      act(() => {
        jest.advanceTimersByTime(2000); // Second retry at 2s
      });

      act(() => {
        jest.advanceTimersByTime(4000); // Third retry at 4s
      });

      expect(reconnectAttempts.length).toBeGreaterThanOrEqual(3);

      jest.useRealTimers();
    });

    it("should show offline banner when connection is lost", async () => {
      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for WebSocket to be created
      await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
      });

      // Simulate network offline
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      // Should show offline banner
      await waitFor(() => {
        expect(
          screen.getByText(/You are currently offline/i),
        ).toBeInTheDocument();
      });

      // Simulate network online
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      // Should hide offline banner
      await waitFor(() => {
        expect(
          screen.queryByText(/You are currently offline/i),
        ).not.toBeInTheDocument();
      });
    });
  });
});
