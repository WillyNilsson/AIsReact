import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ConnectionStatus } from "../connection-status";
import { websocket } from "@/lib/websocket";

// Mock the websocket module
jest.mock("@/lib/websocket", () => ({
  websocket: {
    getConnectionState: jest.fn(),
    onConnectionStateChange: jest.fn(),
  },
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  WifiOff: ({ className }: { className?: string }) => (
    <div data-testid="wifi-off" className={className} aria-hidden="true" />
  ),
  Wifi: ({ className }: { className?: string }) => (
    <div data-testid="wifi" className={className} aria-hidden="true" />
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle" className={className} aria-hidden="true" />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader" className={className} aria-hidden="true" />
  ),
}));

describe("ConnectionStatus", () => {
  let mockOnConnectionStateChange: jest.Mock;
  interface ConnectionState {
    status:
      | "disconnected"
      | "connecting"
      | "connected"
      | "reconnecting"
      | "error";
    reconnectAttempts: number;
    nextReconnectTime?: number;
    lastError?: string;
  }

  let stateChangeCallbacks: ((state: ConnectionState) => void)[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    stateChangeCallbacks = [];

    // Setup mock implementation
    mockOnConnectionStateChange =
      websocket.onConnectionStateChange as jest.Mock;
    mockOnConnectionStateChange.mockImplementation(
      (callback: (state: ConnectionState) => void) => {
        stateChangeCallbacks.push(callback);
        // Call immediately with current state
        callback({ status: "disconnected", reconnectAttempts: 0 });
        return jest.fn(); // Return unsubscribe function
      },
    );

    (websocket.getConnectionState as jest.Mock).mockReturnValue({
      status: "disconnected",
      reconnectAttempts: 0,
    });
  });

  const triggerStateChange = (state: ConnectionState) => {
    stateChangeCallbacks.forEach((cb) => cb(state));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("visibility", () => {
    it("should be visible when disconnected", () => {
      render(<ConnectionStatus />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("should be visible when connecting", () => {
      render(<ConnectionStatus />);

      act(() => {
        triggerStateChange({ status: "connecting", reconnectAttempts: 0 });
      });

      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });

    it("should be visible when reconnecting", () => {
      render(<ConnectionStatus />);

      act(() => {
        triggerStateChange({ status: "reconnecting", reconnectAttempts: 3 });
      });

      expect(
        screen.getByText("Reconnecting... (Attempt 3/10)"),
      ).toBeInTheDocument();
    });

    it("should be visible when error occurs", () => {
      render(<ConnectionStatus />);

      act(() => {
        triggerStateChange({
          status: "error",
          reconnectAttempts: 0,
          lastError: "Connection timeout",
        });
      });

      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });

    it("should auto-hide after successful connection", async () => {
      render(<ConnectionStatus />);

      act(() => {
        triggerStateChange({ status: "connected", reconnectAttempts: 0 });
      });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Fast-forward 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });
    });

    it("should not hide if status changes before timer", () => {
      render(<ConnectionStatus />);

      act(() => {
        triggerStateChange({ status: "connected", reconnectAttempts: 0 });
      });

      // Fast-forward 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Change to disconnected
      act(() => {
        triggerStateChange({ status: "disconnected", reconnectAttempts: 0 });
      });

      // Fast-forward remaining time
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should still be visible
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });
  });

  describe("status display", () => {
    it("should show correct icon for each status", async () => {
      render(<ConnectionStatus />);

      // Disconnected
      act(() => {
        triggerStateChange({ status: "disconnected", reconnectAttempts: 0 });
      });
      await waitFor(() => {
        expect(screen.getByTestId("wifi-off")).toBeInTheDocument();
      });

      // Connecting
      act(() => {
        triggerStateChange({ status: "connecting", reconnectAttempts: 0 });
      });
      await waitFor(() => {
        expect(screen.getByTestId("loader")).toBeInTheDocument();
        expect(screen.getByTestId("loader")).toHaveClass("animate-spin");
      });

      // Connected
      act(() => {
        triggerStateChange({ status: "connected", reconnectAttempts: 0 });
      });
      await waitFor(() => {
        expect(screen.getByTestId("wifi")).toBeInTheDocument();
      });

      // Error
      act(() => {
        triggerStateChange({ status: "error", reconnectAttempts: 0 });
      });
      await waitFor(() => {
        expect(screen.getByTestId("alert-circle")).toBeInTheDocument();
      });
    });

    it("should show countdown timer when reconnecting", () => {
      render(<ConnectionStatus />);

      const nextReconnectTime = Date.now() + 5000;
      act(() => {
        triggerStateChange({
          status: "reconnecting",
          reconnectAttempts: 2,
          nextReconnectTime,
        });
      });

      expect(screen.getByText("(5s)")).toBeInTheDocument();

      // Advance time
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Force re-render by updating state
      act(() => {
        triggerStateChange({
          status: "reconnecting",
          reconnectAttempts: 2,
          nextReconnectTime,
        });
      });

      expect(screen.getByText("(3s)")).toBeInTheDocument();
    });

    it("should apply correct styling for each status", async () => {
      render(<ConnectionStatus />);

      // Test each status
      const statusStyles = {
        disconnected: "bg-yellow-100 border-yellow-300 text-yellow-800",
        connecting: "bg-blue-100 border-blue-300 text-blue-800",
        connected: "bg-green-100 border-green-300 text-green-800",
        reconnecting: "bg-orange-100 border-orange-300 text-orange-800",
        error: "bg-red-100 border-red-300 text-red-800",
      };

      for (const [status, expectedClasses] of Object.entries(statusStyles)) {
        act(() => {
          triggerStateChange({ status: status as any, reconnectAttempts: 0 });
        });

        await waitFor(() => {
          const statusElement = screen.getByRole("status");
          expectedClasses.split(" ").forEach((className) => {
            expect(statusElement).toHaveClass(className);
          });
        });
      }
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<ConnectionStatus />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveAttribute("aria-atomic", "true");
    });

    it("should have aria-hidden on decorative icons", () => {
      render(<ConnectionStatus />);

      const icon = screen.getByTestId("wifi-off");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("cleanup", () => {
    it("should unsubscribe on unmount", () => {
      const unsubscribe = jest.fn();
      mockOnConnectionStateChange.mockReturnValue(unsubscribe);

      const { unmount } = render(<ConnectionStatus />);

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should clear timer on unmount", () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      const { unmount } = render(<ConnectionStatus />);

      // Trigger connected state to start timer
      act(() => {
        triggerStateChange({ status: "connected", reconnectAttempts: 0 });
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
