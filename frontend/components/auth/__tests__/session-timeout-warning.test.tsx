import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { SessionTimeoutWarning } from "../session-timeout-warning";
import { useAuthStore } from "@/store/authStore";
import * as jwtUtils from "@/lib/utils/jwt";
import { authApi } from "@/lib/api";

// Mock dependencies
const mockRouter = {
  push: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/api");
jest.mock("@/lib/utils/jwt");

const mockUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  role: "user" as const,
  is_active: true,
  is_verified: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

describe("SessionTimeoutWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRouter.push.mockClear();

    useAuthStore.setState({
      user: mockUser,
      accessToken: "mock-token",
      refreshToken: "mock-refresh",
      tokenExpiry: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not show warning when token has more than 5 minutes remaining", () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(10);

    render(<SessionTimeoutWarning />);

    expect(screen.queryByText("Session Expiring Soon")).not.toBeInTheDocument();
  });

  it("shows warning when token has 5 minutes or less remaining", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(5);

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
      expect(
        screen.getByText(/Your session will expire in 5 minutes/),
      ).toBeInTheDocument();
    });
  });

  it("shows correct singular/plural for minutes", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(1);

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your session will expire in 1 minute\./),
      ).toBeInTheDocument();
    });
  });

  it("automatically logs out when token expires", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(0);
    const clearAuthSpy = jest.spyOn(useAuthStore.getState(), "clearAuth");

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(clearAuthSpy).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("extends session when Stay Logged In is clicked", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(3);
    (authApi.refreshToken as jest.Mock).mockResolvedValue({
      access: "new-access-token",
      refresh: "new-refresh-token",
    });
    const setAuthSpy = jest.spyOn(useAuthStore.getState(), "setAuth");

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    });

    const stayLoggedInButton = screen.getByRole("button", {
      name: /stay logged in/i,
    });
    fireEvent.click(stayLoggedInButton);

    await waitFor(() => {
      expect(authApi.refreshToken).toHaveBeenCalled();
      expect(setAuthSpy).toHaveBeenCalledWith(
        mockUser,
        "new-access-token",
        "new-refresh-token",
      );
    });
  });

  it("logs out when Logout button is clicked", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(3);
    const clearAuthSpy = jest.spyOn(useAuthStore.getState(), "clearAuth");

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutButton);

    expect(clearAuthSpy).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/auth/login");
  });

  it("shows error and logs out when refresh fails", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(3);
    (authApi.refreshToken as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );
    const clearAuthSpy = jest.spyOn(useAuthStore.getState(), "clearAuth");

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    });

    const stayLoggedInButton = screen.getByRole("button", {
      name: /stay logged in/i,
    });
    fireEvent.click(stayLoggedInButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to connect to the server. Please check your internet connection and try again.",
        ),
      ).toBeInTheDocument();
    });

    // Wait for auto-logout after error
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(clearAuthSpy).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("checks token expiry every 30 seconds", async () => {
    const getMinutesUntilExpirySpy =
      jwtUtils.getMinutesUntilExpiry as jest.Mock;
    getMinutesUntilExpirySpy.mockReturnValue(10);

    render(<SessionTimeoutWarning />);

    expect(getMinutesUntilExpirySpy).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(30000); // 30 seconds
    });

    expect(getMinutesUntilExpirySpy).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(30000); // Another 30 seconds
    });

    expect(getMinutesUntilExpirySpy).toHaveBeenCalledTimes(3);
  });

  it("rechecks token when tab becomes visible", async () => {
    const getMinutesUntilExpirySpy =
      jwtUtils.getMinutesUntilExpiry as jest.Mock;
    getMinutesUntilExpirySpy.mockReturnValue(10);

    render(<SessionTimeoutWarning />);

    expect(getMinutesUntilExpirySpy).toHaveBeenCalledTimes(1);

    // Simulate tab becoming hidden
    Object.defineProperty(document, "hidden", {
      writable: true,
      value: true,
    });

    // Simulate tab becoming visible again
    Object.defineProperty(document, "hidden", {
      writable: true,
      value: false,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(getMinutesUntilExpirySpy).toHaveBeenCalledTimes(2);
  });

  it("logs out when dialog is closed without extending", async () => {
    (jwtUtils.getMinutesUntilExpiry as jest.Mock).mockReturnValue(3);
    const clearAuthSpy = jest.spyOn(useAuthStore.getState(), "clearAuth");

    render(<SessionTimeoutWarning />);

    await waitFor(() => {
      expect(screen.getByText("Session Expiring Soon")).toBeInTheDocument();
    });

    // Close dialog by clicking outside or pressing Escape
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => {
      expect(clearAuthSpy).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/auth/login");
    });
  });
});
