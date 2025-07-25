import { renderHook, act } from "@testing-library/react";
import {
  useWebSocketConnection,
  useConnectionState,
  useWebSocketEvent,
} from "../useWebSocket";
import { websocket } from "@/lib/websocket";
import { useAuthStore } from "@/store/authStore";
import { mutate } from "swr";

// Mock dependencies
jest.mock("@/lib/websocket", () => ({
  websocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    getConnectionState: jest.fn(),
    onConnectionStateChange: jest.fn(),
  },
}));

jest.mock("@/store/authStore");
jest.mock("swr", () => ({
  mutate: jest.fn(),
}));

describe("useWebSocketConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth store state
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        accessToken: null,
        isAuthenticated: false,
      };
      return selector(state);
    });

    // Mock websocket.on to return unsubscribe function
    (websocket.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it("should connect without token when not authenticated", () => {
    renderHook(() => useWebSocketConnection());

    expect(websocket.connect).toHaveBeenCalledWith();
    expect(websocket.connect).toHaveBeenCalledTimes(1);
  });

  it("should connect with token when authenticated", () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        accessToken: "test-token",
        isAuthenticated: true,
      };
      return selector(state);
    });

    renderHook(() => useWebSocketConnection());

    expect(websocket.connect).toHaveBeenCalledWith("test-token");
  });

  it("should reconnect when token changes", () => {
    const { rerender } = renderHook(() => useWebSocketConnection());

    expect(websocket.connect).toHaveBeenCalledTimes(1);

    // Change token
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        accessToken: "new-token",
        isAuthenticated: true,
      };
      return selector(state);
    });

    rerender();

    expect(websocket.connect).toHaveBeenCalledTimes(2);
    expect(websocket.connect).toHaveBeenLastCalledWith("new-token");
  });

  it("should not reconnect if token remains the same", () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        accessToken: "same-token",
        isAuthenticated: true,
      };
      return selector(state);
    });

    const { rerender } = renderHook(() => useWebSocketConnection());

    expect(websocket.connect).toHaveBeenCalledTimes(1);

    // Rerender with same token
    rerender();

    expect(websocket.connect).toHaveBeenCalledTimes(1);
  });

  it("should disconnect on unmount", () => {
    const { unmount } = renderHook(() => useWebSocketConnection());

    unmount();

    expect(websocket.disconnect).toHaveBeenCalled();
  });

  it("should invalidate SWR cache on reconnection", () => {
    let connectHandler: () => void;
    (websocket.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === "connect") {
        connectHandler = handler;
      }
      return jest.fn();
    });

    renderHook(() => useWebSocketConnection());

    // Trigger connect event
    act(() => {
      connectHandler();
    });

    expect(mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });
  });
});

describe("useConnectionState", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (websocket.getConnectionState as jest.Mock).mockReturnValue({
      status: "disconnected",
      reconnectAttempts: 0,
    });

    (websocket.onConnectionStateChange as jest.Mock).mockImplementation(
      (callback) => {
        // Immediately call with current state
        callback({ status: "disconnected", reconnectAttempts: 0 });
        return jest.fn(); // Return unsubscribe
      },
    );
  });

  it("should return initial connection state", () => {
    const { result } = renderHook(() => useConnectionState());

    expect(result.current).toEqual({
      status: "disconnected",
      reconnectAttempts: 0,
    });
  });

  it("should update state when connection changes", () => {
    interface ConnectionState {
      status:
        | "disconnected"
        | "connecting"
        | "connected"
        | "reconnecting"
        | "error";
      reconnectAttempts: number;
    }
    let stateChangeCallback: (state: ConnectionState) => void;
    (websocket.onConnectionStateChange as jest.Mock).mockImplementation(
      (callback) => {
        stateChangeCallback = callback;
        callback({ status: "disconnected", reconnectAttempts: 0 });
        return jest.fn();
      },
    );

    const { result } = renderHook(() => useConnectionState());

    act(() => {
      stateChangeCallback({ status: "connecting", reconnectAttempts: 0 });
    });

    expect(result.current).toEqual({
      status: "connecting",
      reconnectAttempts: 0,
    });
  });

  it("should unsubscribe on unmount", () => {
    const unsubscribe = jest.fn();
    (websocket.onConnectionStateChange as jest.Mock).mockReturnValue(
      unsubscribe,
    );

    const { unmount } = renderHook(() => useConnectionState());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("useWebSocketEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (websocket.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it("should subscribe to event with callback", () => {
    const callback = jest.fn();

    renderHook(() => useWebSocketEvent("post:created", callback));

    expect(websocket.on).toHaveBeenCalledWith(
      "post:created",
      expect.any(Function),
    );
  });

  it("should handle callback updates correctly", () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    let wrappedCallback: (data: unknown) => void;
    (websocket.on as jest.Mock).mockImplementation((event, handler) => {
      wrappedCallback = handler as (data: unknown) => void;
      return jest.fn();
    });

    const { rerender } = renderHook(
      ({ cb }) => useWebSocketEvent("post:created", cb),
      { initialProps: { cb: callback1 } },
    );

    // Call with first callback
    const testData = { id: 1 };
    act(() => {
      wrappedCallback(testData);
    });

    expect(callback1).toHaveBeenCalledWith(testData);
    expect(callback2).not.toHaveBeenCalled();

    // Update to second callback
    rerender({ cb: callback2 });

    // Call with second callback
    callback1.mockClear();
    act(() => {
      wrappedCallback(testData);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith(testData);
  });

  it("should respect dependency array", () => {
    const callback = jest.fn();
    const unsubscribe = jest.fn();
    (websocket.on as jest.Mock).mockReturnValue(unsubscribe);

    const { rerender } = renderHook(
      ({ dep }) => useWebSocketEvent("post:created", callback, [dep]),
      { initialProps: { dep: "value1" } },
    );

    expect(websocket.on).toHaveBeenCalledTimes(1);

    // Rerender with same dependency
    rerender({ dep: "value1" });
    expect(websocket.on).toHaveBeenCalledTimes(1);

    // Rerender with different dependency
    rerender({ dep: "value2" });
    expect(unsubscribe).toHaveBeenCalled();
    expect(websocket.on).toHaveBeenCalledTimes(2);
  });

  it("should unsubscribe on unmount", () => {
    const unsubscribe = jest.fn();
    (websocket.on as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() =>
      useWebSocketEvent("post:created", jest.fn()),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
