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
import { FeedCardWithImage } from "@/components/feed/feed-card-with-image";
import { act } from "@testing-library/react";
import { PostFeedItem } from "@/lib/types";

// Helper to create PostFeedItem
const createMockPost = (overrides: any = {}): PostFeedItem =>
  ({
    ...mockApiResponses.posts.list[0],
    user: { id: 1, username: "testuser", role: "user" },
    source_url: "https://example.com",
    verification_score: 5,
    verification_count: 10,
    ...overrides,
  }) as PostFeedItem;

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
  }) as any;

  afterEach(() => {
    if (mockWebSocket) {
      mockWebSocket.close();
    }
  }) as any;

  describe("Real-time Vote Updates", () => {
    it("should update vote count in real-time when receiving WebSocket message", async () => {
      const post = createMockPost();

      render(
        <WebSocketProvider>
          <FeedCardWithImage post={post} />
        </WebSocketProvider>,
      );

      // Initial vote count
      expect(screen.getByText(/5 votes/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /vote/i })).not.toBeDisabled();

      // Wait for WebSocket connection
      (await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

      // Simulate vote update from WebSocket
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "vote_update",
          post_id: post.id,
          vote_count: 10,
          user_has_voted: true,
        }) as any;
      }) as any;

      // Check updated UI
      (await waitFor(() => {
        expect(screen.getByText(/10 votes/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /voted/i })).toBeDisabled();
      })) as any;
    }) as any;

    it("should handle WebSocket reconnection gracefully", async () => {
      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for initial connection
      (await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

      // Simulate disconnect
      act(() => {
        mockWebSocket?.close();
      }) as any;

      // Should show connection status
      (await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      })) as any;

      // Simulate reconnection
      act(() => {
        // Create new WebSocket instance
        const newWs = new MockWebSocket("ws://localhost:8000/ws");
        mockWebSocket = newWs;
        global.WebSocket = jest.fn().mockReturnValue(newWs) as any;

        // Trigger reconnect by simulating timer
        jest.advanceTimersByTime(5000);
      }) as any;

      // Should reconnect
      (await waitFor(() => {
        expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
      })) as any;
    }) as any;

    it("should queue messages during disconnection and process on reconnect", async () => {
      const user = setupUser();
      const post = createMockPost();

      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          data: mockApiResponses.verification.vote.success,
        },
      }) as any;

      render(
        <WebSocketProvider>
          <FeedCardWithImage post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket to be created
      (await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
      })) as any;

      // Disconnect WebSocket
      act(() => {
        mockWebSocket?.close();
      }) as any;

      // Vote while disconnected
      const voteButton = screen.getByRole("button", { name: /vote/i }) as any;
      await user.click(voteButton);

      // Should show optimistic update
      expect(screen.getByText(/6 votes/i)).toBeInTheDocument();

      // Reconnect
      act(() => {
        const newWs = new MockWebSocket("ws://localhost:8000/ws");
        mockWebSocket = newWs;
        global.WebSocket = jest.fn().mockReturnValue(newWs) as any;
      }) as any;

      // Should sync state after reconnection
      (await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts/1/vote"),
          expect.any(Object),
        );
      })) as any;
    }) as any;
  }) as any;

  describe("Real-time AI Analysis Updates", () => {
    it("should show AI analysis progress in real-time", async () => {
      const post = createMockPost({ status: "analyzing" });

      render(
        <WebSocketProvider>
          <FeedCardWithImage post={post} />
        </WebSocketProvider>,
      );

      // Should show analyzing status
      expect(screen.getByText(/AI Analysis in Progress/i)).toBeInTheDocument();

      // Wait for WebSocket connection
      (await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

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
        }) as any;
      }) as any;

      // Should update progress display
      (await waitFor(() => {
        expect(screen.getByText(/OpenAI: Complete/i)).toBeInTheDocument();
        expect(screen.getByText(/Anthropic: 50%/i)).toBeInTheDocument();
      })) as any;

      // Simulate completion
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "ai_analysis_complete",
          post_id: post.id,
          status: "verified",
        }) as any;
      }) as any;

      // Should show completion
      (await waitFor(() => {
        expect(
          screen.queryByText(/AI Analysis in Progress/i),
        ).not.toBeInTheDocument();
        expect(screen.getByText(/View AI Responses/i)).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should handle AI analysis errors gracefully", async () => {
      const post = createMockPost({ status: "analyzing" });

      render(
        <WebSocketProvider>
          <FeedCardWithImage post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket
      (await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

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
        }) as any;
      }) as any;

      // Should show error state
      (await waitFor(() => {
        expect(screen.getByText(/AI Analysis Failed/i)).toBeInTheDocument();
        expect(
          screen.getByText(/All AI providers failed/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Multiple Component Synchronization", () => {
    it("should update multiple components showing same post", async () => {
      const post = createMockPost();

      render(
        <WebSocketProvider>
          <div>
            <FeedCardWithImage post={post} />
            <FeedCardWithImage post={post} />
          </div>
        </WebSocketProvider>,
      );

      // Both should show initial state
      const voteButtons = screen.getAllByRole("button", {
        name: /vote/i,
      }) as any;
      expect(voteButtons).toHaveLength(2);
      expect(screen.getAllByText(/5 votes/i)).toHaveLength(2);

      // Wait for WebSocket
      (await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

      // Simulate vote update
      act(() => {
        mockWebSocket?.simulateMessage({
          type: "vote_update",
          post_id: post.id,
          vote_count: 8,
          user_has_voted: false,
        }) as any;
      }) as any;

      // Both components should update
      (await waitFor(() => {
        expect(screen.getAllByText(/8 votes/i)).toHaveLength(2);
      })) as any;
    }) as any;

    it("should handle rapid WebSocket messages without race conditions", async () => {
      const post = createMockPost();

      render(
        <WebSocketProvider>
          <FeedCardWithImage post={post} />
        </WebSocketProvider>,
      );

      // Wait for WebSocket
      (await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(1);
      })) as any;

      // Send rapid updates
      act(() => {
        for (let i = 6; i <= 15; i++) {
          mockWebSocket?.simulateMessage({
            type: "vote_update",
            post_id: post.id,
            vote_count: i,
            user_has_voted: false,
          }) as any;
        }
      }) as any;

      // Should show final state
      (await waitFor(() => {
        expect(screen.getByText(/15 votes/i)).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Error Recovery", () => {
    it("should reconnect with exponential backoff on connection failure", async () => {
      jest.useFakeTimers();

      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for component to mount
      (await waitFor(() => {
        expect(screen.getByText("Test Content")).toBeInTheDocument();
      })) as any;

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
      }) as any;

      // Should show reconnecting status
      (await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      })) as any;

      // Should retry with backoff
      act(() => {
        jest.advanceTimersByTime(1000); // First retry at 1s
      }) as any;

      act(() => {
        jest.advanceTimersByTime(2000); // Second retry at 2s
      }) as any;

      act(() => {
        jest.advanceTimersByTime(4000); // Third retry at 4s
      }) as any;

      expect(reconnectAttempts.length).toBeGreaterThanOrEqual(3);

      jest.useRealTimers();
    }) as any;

    it("should show offline banner when connection is lost", async () => {
      render(
        <WebSocketProvider>
          <div>Test Content</div>
        </WebSocketProvider>,
      );

      // Wait for WebSocket to be created
      (await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
      })) as any;

      // Simulate network offline
      act(() => {
        window.dispatchEvent(new Event("offline"));
      }) as any;

      // Should show offline banner
      (await waitFor(() => {
        expect(
          screen.getByText(/You are currently offline/i),
        ).toBeInTheDocument();
      })) as any;

      // Simulate network online
      act(() => {
        window.dispatchEvent(new Event("online"));
      }) as any;

      // Should hide offline banner
      (await waitFor(() => {
        expect(
          screen.queryByText(/You are currently offline/i),
        ).not.toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;
}) as any;
