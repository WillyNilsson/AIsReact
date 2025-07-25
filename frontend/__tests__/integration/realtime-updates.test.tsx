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
import { act } from "@testing-library/react";

// Simple mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }
}

describe("Real-time Updates Integration", () => {
  let mockWebSocket: MockWebSocket | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore(true, mockApiResponses.login.success.user);
    mockWebSocket = null;

    // Mock WebSocket globally
    global.WebSocket = jest.fn().mockImplementation((url: string) => {
      mockWebSocket = new MockWebSocket(url);
      return mockWebSocket;
    }) as any;
  });

  afterEach(() => {
    mockWebSocket?.close();
  });

  describe("Vote Updates", () => {
    it("should handle real-time vote updates", async () => {
      // Simple component that listens to WebSocket
      const VoteDisplay = ({ postId }: { postId: number }) => {
        const [voteCount, setVoteCount] = React.useState(5);
        const [hasVoted, setHasVoted] = React.useState(false);

        React.useEffect(() => {
          const ws = new WebSocket("ws://localhost:8000/ws");

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "vote_update" && data.post_id === postId) {
              setVoteCount(data.vote_count);
              setHasVoted(data.user_has_voted);
            }
          };

          return () => ws.close();
        }, [postId]);

        return (
          <div>
            <span data-testid="vote-count">{voteCount} votes</span>
            <button disabled={hasVoted}>{hasVoted ? "Voted" : "Vote"}</button>
          </div>
        );
      };

      render(<VoteDisplay postId={1} />);

      // Initial state
      expect(screen.getByTestId("vote-count")).toHaveTextContent("5 votes");
      expect(screen.getByRole("button")).toHaveTextContent("Vote");

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(mockWebSocket).toBeTruthy();
        expect(mockWebSocket?.readyState).toBe(MockWebSocket.OPEN);
      });

      // Simulate vote update from server
      act(() => {
        const message = {
          type: "vote_update",
          post_id: 1,
          vote_count: 10,
          user_has_voted: true,
        };
        mockWebSocket?.onmessage?.(
          new MessageEvent("message", {
            data: JSON.stringify(message),
          }),
        );
      });

      // Check updated state
      await waitFor(() => {
        expect(screen.getByTestId("vote-count")).toHaveTextContent("10 votes");
        expect(screen.getByRole("button")).toHaveTextContent("Voted");
        expect(screen.getByRole("button")).toBeDisabled();
      });
    });

    it("should handle optimistic updates with API calls", async () => {
      const user = setupUser();

      // Mock API response
      global.fetch = mockFetch({
        "POST /api/posts/1/vote": { data: { new_vote_count: 6 } },
      });

      const OptimisticVote = () => {
        const [voteCount, setVoteCount] = React.useState(5);
        const [isVoting, setIsVoting] = React.useState(false);

        const handleVote = async () => {
          setIsVoting(true);
          // Optimistic update
          setVoteCount((prev) => prev + 1);

          try {
            const response = await fetch("/api/posts/1/vote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            setVoteCount(data.new_vote_count);
          } catch (error) {
            // Revert on error
            setVoteCount((prev) => prev - 1);
          } finally {
            setIsVoting(false);
          }
        };

        return (
          <div>
            <span data-testid="vote-count">{voteCount} votes</span>
            <button onClick={handleVote} disabled={isVoting}>
              {isVoting ? "Voting..." : "Vote"}
            </button>
          </div>
        );
      };

      render(<OptimisticVote />);

      // Click vote
      await user.click(screen.getByRole("button"));

      // Should show optimistic update immediately
      expect(screen.getByTestId("vote-count")).toHaveTextContent("6 votes");

      // The button might not update to "Voting..." immediately due to async state
      await waitFor(() => {
        expect(screen.getByRole("button")).toHaveTextContent("Voting...");
      });

      // Wait for API response
      await waitFor(() => {
        expect(screen.getByRole("button")).toHaveTextContent("Vote");
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/posts/1/vote",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("AI Analysis Progress", () => {
    it("should display AI analysis progress updates", async () => {
      const AIProgress = ({ postId }: { postId: number }) => {
        const [providers, setProviders] = React.useState({
          openai: { status: "pending", progress: 0 },
          anthropic: { status: "pending", progress: 0 },
          google: { status: "pending", progress: 0 },
        });

        React.useEffect(() => {
          const ws = new WebSocket("ws://localhost:8000/ws");

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "ai_progress" && data.post_id === postId) {
              setProviders(data.providers);
            }
          };

          return () => ws.close();
        }, [postId]);

        return (
          <div>
            <h3>AI Analysis Progress</h3>
            {Object.entries(providers).map(([name, data]: [string, any]) => (
              <div key={name} data-testid={`${name}-status`}>
                {name}:{" "}
                {data.status === "completed" ? "Complete" : `${data.progress}%`}
              </div>
            ))}
          </div>
        );
      };

      render(<AIProgress postId={1} />);

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocket?.readyState).toBe(MockWebSocket.OPEN);
      });

      // Send progress update
      act(() => {
        mockWebSocket?.onmessage?.(
          new MessageEvent("message", {
            data: JSON.stringify({
              type: "ai_progress",
              post_id: 1,
              providers: {
                openai: { status: "completed", progress: 100 },
                anthropic: { status: "processing", progress: 50 },
                google: { status: "pending", progress: 0 },
              },
            }),
          }),
        );
      });

      // Check updates
      await waitFor(() => {
        expect(screen.getByTestId("openai-status")).toHaveTextContent(
          "openai: Complete",
        );
        expect(screen.getByTestId("anthropic-status")).toHaveTextContent(
          "anthropic: 50%",
        );
        expect(screen.getByTestId("google-status")).toHaveTextContent(
          "google: 0%",
        );
      });
    });
  });

  describe("Connection Management", () => {
    it("should handle connection state changes", async () => {
      const ConnectionIndicator = () => {
        const [status, setStatus] = React.useState("connecting");

        React.useEffect(() => {
          const ws = new WebSocket("ws://localhost:8000/ws");

          ws.onopen = () => setStatus("connected");
          ws.onclose = () => setStatus("disconnected");
          ws.onerror = () => setStatus("error");

          return () => ws.close();
        }, []);

        return <div data-testid="connection-status">{status}</div>;
      };

      render(<ConnectionIndicator />);

      // Initially connecting
      expect(screen.getByTestId("connection-status")).toHaveTextContent(
        "connecting",
      );

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "connected",
        );
      });

      // Simulate disconnection
      act(() => {
        mockWebSocket?.close();
      });

      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent(
          "disconnected",
        );
      });
    });

    it("should handle offline/online events", async () => {
      const OfflineDetector = () => {
        const [isOnline, setIsOnline] = React.useState(navigator.onLine);

        React.useEffect(() => {
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);

          window.addEventListener("online", handleOnline);
          window.addEventListener("offline", handleOffline);

          return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
          };
        }, []);

        return (
          <div>
            {isOnline ? (
              <span data-testid="status">Online</span>
            ) : (
              <span data-testid="status">You are currently offline</span>
            )}
          </div>
        );
      };

      render(<OfflineDetector />);

      // Should be online initially
      expect(screen.getByTestId("status")).toHaveTextContent("Online");

      // Simulate going offline
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(screen.getByTestId("status")).toHaveTextContent(
        "You are currently offline",
      );

      // Simulate going back online
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(screen.getByTestId("status")).toHaveTextContent("Online");
    });
  });
});
