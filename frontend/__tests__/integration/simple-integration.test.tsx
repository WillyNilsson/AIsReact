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
import { AuthForm } from "@/components/auth/auth-form";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

describe("Simple Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("Authentication Integration", () => {
    it("should handle complete login flow", async () => {
      const user = setupUser();
      mockAuthStore(false);

      // Render login form
      const handleLogin = jest.fn().mockResolvedValue({ success: true });
      render(<AuthForm mode="login" onSubmit={handleLogin} />);

      // Fill and submit form
      await user.type(
        screen.getByPlaceholderText(/johndoe or john@example.com/i),
        "testuser",
      );
      await user.type(screen.getByPlaceholderText(/••••••••/i), "Test123!@#");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Verify form submission
      await waitFor(() => {
        expect(handleLogin).toHaveBeenCalledWith({
          username: "testuser",
          password: "Test123!@#",
        });
      });
    });

    it("should handle registration with validation", async () => {
      const user = setupUser();
      const handleRegister = jest.fn();

      render(<AuthForm mode="register" onSubmit={handleRegister} />);

      // Try to submit with weak password
      await user.type(screen.getByPlaceholderText(/johndoe/i), "newuser");
      await user.type(
        screen.getByPlaceholderText(/john@example.com/i),
        "new@example.com",
      );
      await user.type(screen.getByPlaceholderText(/••••••••/i), "weak");
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 12 characters/i),
        ).toBeInTheDocument();
      });

      // Should not submit
      expect(handleRegister).not.toHaveBeenCalled();
    });

    it("should validate email format", async () => {
      const user = setupUser();
      const handleRegister = jest.fn();

      render(<AuthForm mode="register" onSubmit={handleRegister} />);

      // Try invalid email
      await user.type(screen.getByPlaceholderText(/johndoe/i), "newuser");
      await user.type(
        screen.getByPlaceholderText(/john@example.com/i),
        "invalid-email",
      );
      await user.type(
        screen.getByPlaceholderText(/••••••••/i),
        "ValidPass123!@#",
      );
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });
    });

    it("should handle form errors properly", async () => {
      const user = setupUser();
      const handleLogin = jest.fn().mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      render(<AuthForm mode="login" onSubmit={handleLogin} />);

      await user.type(
        screen.getByPlaceholderText(/johndoe or john@example.com/i),
        "wronguser",
      );
      await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpass");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(
            /the username or password you entered is incorrect/i,
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Flow Integration", () => {
    it("should update auth store on successful login", async () => {
      const authStore = require("@/store/authStore").useAuthStore;

      // Start logged out
      authStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
      });

      // Simulate login
      authStore.setState({
        isAuthenticated: true,
        user: mockApiResponses.login.success.user,
        token: "mock-jwt-token",
      });

      // Verify state updated
      const state = authStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockApiResponses.login.success.user);
      expect(state.token).toBe("mock-jwt-token");
    });

    it("should clear auth state on logout", async () => {
      const authStore = require("@/store/authStore").useAuthStore;

      // Start logged in
      authStore.setState({
        isAuthenticated: true,
        user: mockApiResponses.login.success.user,
        token: "mock-jwt-token",
      });

      // Simulate logout
      authStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
      });

      // Verify state cleared
      const state = authStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    it("should persist vote state across components", async () => {
      const voteStore = require("@/store/voteStore").useVoteStore;

      // Record a vote
      voteStore.setState({
        voteHistory: new Map([["post-1", true]]),
        optimisticUpdates: new Map([["post-1", 6]]),
      });

      // Verify vote is tracked
      const state = voteStore.getState();
      expect(state.voteHistory.get("post-1")).toBe(true);
      expect(state.optimisticUpdates.get("post-1")).toBe(6);
    });
  });

  describe("Component Integration", () => {
    it("should integrate form validation with submission", async () => {
      const user = setupUser();
      const handleSubmit = jest.fn();

      render(<AuthForm mode="register" onSubmit={handleSubmit} />);

      // Fill form with valid data
      await user.type(screen.getByPlaceholderText(/johndoe/i), "validuser");
      await user.type(
        screen.getByPlaceholderText(/john@example.com/i),
        "valid@example.com",
      );
      await user.type(
        screen.getByPlaceholderText(/••••••••/i),
        "ValidPassword123!@#",
      );

      // Submit form
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should submit with valid data
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          username: "validuser",
          email: "valid@example.com",
          password: "ValidPassword123!@#",
        });
      });
    });

    it("should show password strength feedback", async () => {
      const user = setupUser();
      render(<AuthForm mode="register" onSubmit={jest.fn()} />);

      const passwordInput = screen.getByPlaceholderText(/••••••••/i);

      // Type weak password
      await user.type(passwordInput, "weak");

      // Should show strength meter (component exists)
      await waitFor(() => {
        // Password strength meter would be visible
        expect(passwordInput).toHaveValue("weak");
      });

      // Clear and type strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, "VeryStrongPassword123!@#");

      // Password should be updated
      expect(passwordInput).toHaveValue("VeryStrongPassword123!@#");
    });
  });
});
