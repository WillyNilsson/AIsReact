/**
 * Tests for session timeout warning functionality
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionTimeoutWarning } from "../session-timeout-warning";
import { SessionIndicator } from "../session-indicator";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";

// Mock dependencies
jest.mock("@/store/authStore");
jest.mock("@/lib/api");

describe("SessionTimeoutWarning", () => {
  const mockUser = { id: 1, username: "testuser", email: "test@example.com" };
  const mockSetAuth = jest.fn();

  // Create mock JWT token with expiry
  const createMockToken = (expiresInSeconds: number) => {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = { exp, user_id: 1 };
    const encodedPayload = btoa(JSON.stringify(payload));
    return `header.${encodedPayload}.signature`;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default auth store mock
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
      accessToken: createMockToken(300), // 5 minutes
      refreshToken: "mock-refresh-token",
      setAuth: mockSetAuth,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not show warning when token has more than 5 minutes remaining", () => {
    // Token expires in 10 minutes
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
      accessToken: createMockToken(600),
      refreshToken: "mock-refresh-token",
      setAuth: mockSetAuth,
    });

    render(<SessionTimeoutWarning />);

    expect(screen.queryByText("Session Expiring Soon")).not.toBeInTheDocument();
  });

  it("should show warning when token has less than 5 minutes remaining", () => {
    // Token expires in 4 minutes
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
      accessToken: createMockToken(240),
      refreshToken: "mock-refresh-token",
      setAuth: mockSetAuth,
    });

    render(<SessionTimeoutWarning />);

    expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    expect(screen.getByText(/Your session will expire in/)).toBeInTheDocument();
  });

  it("should handle token refresh on button click", async () => {
    const mockRefreshResponse = {
      access: "new-access-token",
      refresh: "new-refresh-token",
    };

    (authApi.refreshToken as jest.Mock).mockResolvedValue(mockRefreshResponse);

    render(<SessionTimeoutWarning />);

    // Click extend session button
    const extendButton = screen.getByText("Stay Logged In");
    fireEvent.click(extendButton);

    await waitFor(() => {
      expect(authApi.refreshToken).toHaveBeenCalled();
      expect(mockSetAuth).toHaveBeenCalledWith(
        mockUser,
        "new-access-token",
        "new-refresh-token",
      );
    });
  });

  it("should handle refresh failure gracefully", async () => {
    (authApi.refreshToken as jest.Mock).mockRejectedValue(
      new Error("Refresh failed"),
    );

    render(<SessionTimeoutWarning />);

    const extendButton = screen.getByText("Extend Session");
    fireEvent.click(extendButton);

    await waitFor(() => {
      expect(authApi.refreshToken).toHaveBeenCalled();
      // Should not crash, warning should remain visible
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    });
  });

  it("should not render when user is not authenticated", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: mockSetAuth,
    });

    const { container } = render(<SessionTimeoutWarning />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SessionIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createMockToken = (expiresInSeconds: number) => {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = { exp, user_id: 1 };
    const encodedPayload = btoa(JSON.stringify(payload));
    return `header.${encodedPayload}.signature`;
  };

  it("should not show indicator when token has more than 15 minutes remaining", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      accessToken: createMockToken(1000), // ~16 minutes
    });

    const { container } = render(<SessionIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("should show indicator when token has less than 15 minutes remaining", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      accessToken: createMockToken(600), // 10 minutes
    });

    render(<SessionIndicator />);

    expect(screen.getByTitle(/Session expires in/)).toBeInTheDocument();
  });

  it("should show pulsing animation when less than 5 minutes remaining", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      accessToken: createMockToken(240), // 4 minutes
    });

    render(<SessionIndicator />);

    const indicator = screen.getByTitle(/Session expires in/);
    expect(indicator).toHaveClass("animate-pulse");
    expect(indicator).toHaveClass("bg-destructive/10");
  });

  it("should format time correctly", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      accessToken: createMockToken(125), // 2 minutes 5 seconds
    });

    render(<SessionIndicator />);

    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("should format seconds correctly when less than a minute", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      accessToken: createMockToken(45), // 45 seconds
    });

    render(<SessionIndicator />);

    expect(screen.getByText("45s")).toBeInTheDocument();
  });
});
