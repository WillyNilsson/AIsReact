import { websocket } from "../websocket";
import { io, Socket } from "socket.io-client";

// Mock socket.io-client
jest.mock("socket.io-client");

// Type-safe helper to access private properties
type WebSocketPrivate = typeof websocket & {
  socket: Socket | null;
  reconnectAttempts: number;
  isIntentionalDisconnect: boolean;
  lastToken: string | undefined;
  subscribedPosts: Set<number>;
  subscribedFeeds: Set<string>;
  stateListeners: Set<(state: unknown) => void>;
  connectionState: {
    status: string;
    reconnectAttempts: number;
    lastError?: string;
  };
  notifyListeners: (event: string, data: unknown) => void;
};

describe("WebSocketService", () => {
  let mockSocket: Partial<Socket>;
  let mockIo: jest.MockedFunction<typeof io>;
  let ws: WebSocketPrivate;

  beforeEach(() => {
    // Reset singleton state
    ws = websocket as WebSocketPrivate;
    ws.socket = null;
    ws.reconnectAttempts = 0;
    ws.isIntentionalDisconnect = false;
    ws.lastToken = undefined;
    ws.subscribedPosts.clear();
    ws.subscribedFeeds.clear();
    ws.stateListeners.clear();
    ws.connectionState = {
      status: "disconnected",
      reconnectAttempts: 0,
    };

    // Clear timers
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Mock socket instance
    mockSocket = {
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    mockIo = io as jest.MockedFunction<typeof io>;
    mockIo.mockReturnValue(mockSocket as Socket);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("connect", () => {
    it("should establish connection without token", () => {
      websocket.connect();

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          path: "/ws",
          transports: ["websocket", "polling"],
          auth: undefined,
          reconnection: false,
          timeout: 20000,
          forceNew: true,
        }),
      );
    });

    it("should establish connection with token", () => {
      const token = "test-jwt-token";
      websocket.connect(token);

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token },
        }),
      );
    });

    it("should not reconnect if already connected", () => {
      mockSocket.connected = true;
      ws.socket = mockSocket as Socket;

      websocket.connect();

      expect(mockIo).not.toHaveBeenCalled();
    });

    it("should update connection state to connecting", () => {
      const stateListener = jest.fn();
      websocket.onConnectionStateChange(stateListener);

      websocket.connect();

      expect(stateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "connecting",
          reconnectAttempts: 0,
        }),
      );
    });
  });

  describe("disconnect", () => {
    beforeEach(() => {
      websocket.connect();
    });

    it("should disconnect socket and clear state", () => {
      websocket.disconnect();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(ws.socket).toBeNull();
    });

    it("should clear subscriptions on disconnect", () => {
      // Add some subscriptions
      websocket.subscribeToPost(1);
      websocket.subscribeToFeed("live");

      websocket.disconnect();

      expect(ws.subscribedPosts.size).toBe(0);
      expect(ws.subscribedFeeds.size).toBe(0);
    });

    it("should set intentional disconnect flag", () => {
      websocket.disconnect();

      expect(ws.isIntentionalDisconnect).toBe(true);
    });

    it("should update connection state to disconnected", () => {
      const stateListener = jest.fn();
      websocket.onConnectionStateChange(stateListener);
      stateListener.mockClear();

      websocket.disconnect();

      expect(stateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "disconnected",
          reconnectAttempts: 0,
        }),
      );
    });
  });

  describe("automatic reconnection", () => {
    let connectHandler: () => void;
    let disconnectHandler: (reason: string) => void;
    let errorHandler: (error: Error) => void;

    beforeEach(() => {
      // Capture event handlers
      mockSocket.on = jest.fn(
        (event: string, handler: (...args: unknown[]) => void) => {
          if (event === "connect") {
            connectHandler = handler as () => void;
          }
          if (event === "disconnect") {
            disconnectHandler = handler as (reason: string) => void;
          }
          if (event === "connect_error") {
            errorHandler = handler as (error: Error) => void;
          }
          return mockSocket;
        },
      ) as jest.MockedFunction<Socket["on"]>;

      websocket.connect();
    });

    it("should attempt reconnection on unintentional disconnect", () => {
      disconnectHandler("transport close");

      // Fast-forward to trigger reconnection
      jest.advanceTimersByTime(1000);

      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it("should not reconnect on intentional disconnect", () => {
      ws.isIntentionalDisconnect = true;
      disconnectHandler("io client disconnect");

      jest.advanceTimersByTime(5000);

      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it("should use exponential backoff for reconnection", () => {
      const stateListener = jest.fn();
      websocket.onConnectionStateChange(stateListener);

      // First reconnection attempt
      errorHandler(new Error("Connection failed"));
      expect(stateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "reconnecting",
          reconnectAttempts: 0,
        }),
      );

      jest.advanceTimersByTime(1000); // Base delay
      expect(mockIo).toHaveBeenCalledTimes(2);

      // Second reconnection attempt
      errorHandler(new Error("Connection failed"));
      jest.advanceTimersByTime(2000); // 2x base delay
      expect(mockIo).toHaveBeenCalledTimes(3);

      // Third reconnection attempt
      errorHandler(new Error("Connection failed"));
      jest.advanceTimersByTime(4000); // 4x base delay
      expect(mockIo).toHaveBeenCalledTimes(4);
    });

    it("should stop reconnecting after max attempts", () => {
      const stateListener = jest.fn();
      websocket.onConnectionStateChange(stateListener);

      // Simulate max reconnection attempts
      for (let i = 0; i < 10; i++) {
        errorHandler(new Error("Connection failed"));
        jest.advanceTimersByTime(30000); // Max delay
      }

      // Should not attempt more reconnections
      errorHandler(new Error("Connection failed"));
      jest.advanceTimersByTime(60000);

      expect(stateListener).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "error",
          lastError: "Maximum reconnection attempts reached",
        }),
      );
    });

    it("should reset reconnection attempts on successful connection", () => {
      // Simulate failed attempts
      errorHandler(new Error("Connection failed"));
      jest.advanceTimersByTime(1000);
      errorHandler(new Error("Connection failed"));

      // Successful connection
      connectHandler();

      expect(ws.reconnectAttempts).toBe(0);
    });
  });

  describe("subscription management", () => {
    beforeEach(() => {
      websocket.connect();
      // Mock socket as connected for emit to work
      mockSocket.connected = true;
    });

    it("should track post subscriptions", () => {
      websocket.subscribeToPost(123);

      expect(ws.subscribedPosts.has(123)).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:post", {
        postId: 123,
      });
    });

    it("should track feed subscriptions", () => {
      websocket.subscribeToFeed("live");

      expect(ws.subscribedFeeds.has("live")).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:feed", {
        feedType: "live",
      });
    });

    it("should remove subscriptions on unsubscribe", () => {
      websocket.subscribeToPost(123);
      websocket.unsubscribeFromPost(123);

      expect(ws.subscribedPosts.has(123)).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith("unsubscribe:post", {
        postId: 123,
      });
    });

    it("should resubscribe to all on reconnection", () => {
      // Subscribe to multiple items
      websocket.subscribeToPost(1);
      websocket.subscribeToPost(2);
      websocket.subscribeToFeed("live");
      websocket.subscribeToFeed("verification");

      // Clear emit calls
      (mockSocket.emit as jest.Mock).mockClear();

      // Simulate successful reconnection
      const connectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "connect",
      )[1];
      connectHandler();

      // Should resubscribe to all
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:post", {
        postId: 1,
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:post", {
        postId: 2,
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:feed", {
        feedType: "live",
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe:feed", {
        feedType: "verification",
      });
    });
  });

  describe("connection state management", () => {
    it("should notify listeners of state changes", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      websocket.onConnectionStateChange(listener1);
      websocket.onConnectionStateChange(listener2);

      websocket.connect();

      expect(listener1).toHaveBeenCalledWith(
        expect.objectContaining({ status: "connecting" }),
      );
      expect(listener2).toHaveBeenCalledWith(
        expect.objectContaining({ status: "connecting" }),
      );
    });

    it("should immediately notify new listeners of current state", () => {
      websocket.connect();

      const listener = jest.fn();
      websocket.onConnectionStateChange(listener);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: "connecting" }),
      );
    });

    it("should allow unsubscribing from state changes", () => {
      const listener = jest.fn();
      const unsubscribe = websocket.onConnectionStateChange(listener);

      listener.mockClear();
      unsubscribe();

      websocket.connect();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle errors in state listeners gracefully", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      let callCount = 0;
      const errorListener = jest.fn(() => {
        callCount++;
        // Only throw error after the initial subscription call
        if (callCount > 1) {
          throw new Error("Listener error");
        }
      });
      const normalListener = jest.fn();

      // Subscribe listeners
      const unsubscribeError = websocket.onConnectionStateChange(errorListener);
      const unsubscribeNormal =
        websocket.onConnectionStateChange(normalListener);

      // Clear the initial calls from subscription
      errorListener.mockClear();
      normalListener.mockClear();

      // Trigger a state change via connect - should not throw
      expect(() => websocket.connect()).not.toThrow();

      // Both listeners should have been called
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in connection state listener:",
        expect.any(Error),
      );

      // Cleanup
      unsubscribeError();
      unsubscribeNormal();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("network recovery", () => {
    beforeEach(() => {
      // Mock document and window
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "visible",
      });

      Object.defineProperty(window, "addEventListener", {
        writable: true,
        value: jest.fn(),
      });

      Object.defineProperty(document, "addEventListener", {
        writable: true,
        value: jest.fn(),
      });
    });

    it("should reconnect when page becomes visible", () => {
      websocket.connect();

      // Get visibility change handler
      const visibilityHandler = (
        document.addEventListener as jest.Mock
      ).mock.calls.find((call) => call[0] === "visibilitychange")?.[1];

      expect(visibilityHandler).toBeDefined();

      // Simulate disconnect
      ws.socket = null;

      // Simulate page becoming visible
      Object.defineProperty(document, "visibilityState", { value: "visible" });
      visibilityHandler();

      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it("should reconnect when network comes online", () => {
      websocket.connect();

      // Get online handler
      const onlineHandler = (
        window.addEventListener as jest.Mock
      ).mock.calls.find((call) => call[0] === "online")?.[1];

      expect(onlineHandler).toBeDefined();

      // Simulate disconnect
      ws.socket = null;

      // Simulate network coming online
      onlineHandler();

      expect(mockIo).toHaveBeenCalledTimes(2);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      websocket.connect();
    });

    it("should register and notify event listeners", () => {
      const postListener = jest.fn();
      const unsubscribe = websocket.on("post:created", postListener);

      // Simulate event from socket
      const socketHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "post:created",
      )?.[1];

      const mockPost = { id: 1, title: "Test" };
      socketHandler(mockPost);

      expect(postListener).toHaveBeenCalledWith(mockPost);

      // Test unsubscribe
      unsubscribe();
      expect(mockSocket.off).toHaveBeenCalledWith(
        "post:created",
        expect.any(Function),
      );
    });

    it("should handle errors in event listeners", () => {
      const errorListener = jest.fn(() => {
        throw new Error("Event listener error");
      });
      const normalListener = jest.fn();

      websocket.on("post:created", errorListener);
      websocket.on("post:created", normalListener);

      // Trigger internal notify
      ws.notifyListeners("post:created", { id: 1 });

      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("security", () => {
    it("should not expose token in connection state", () => {
      const token = "secret-jwt-token";
      websocket.connect(token);

      const state = websocket.getConnectionState();
      expect(JSON.stringify(state)).not.toContain(token);
    });

    it("should clear sensitive data on disconnect", () => {
      const token = "secret-jwt-token";
      websocket.connect(token);
      websocket.subscribeToPost(1);

      websocket.disconnect();

      expect(ws.lastToken).toBeUndefined();
      expect(ws.subscribedPosts.size).toBe(0);
    });
  });
});
