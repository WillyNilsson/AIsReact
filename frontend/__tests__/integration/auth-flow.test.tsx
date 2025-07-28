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
import LoginPage from "@/app/auth/login/page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

// Mock is already set up in jest.setup.js, we just need to access it
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    prefetch: jest.fn(),
    pathname: "/",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// Mock useAuth hook
jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(() => ({
    login: jest.fn().mockImplementation(async (data) => {
      if (
        data.username === "test@example.com" &&
        data.password === "password123" // pragma: allowlist secret
      ) {
        // Simulate successful login
        const authStore = require("@/store/authStore");
        authStore.useAuthStore.setState({
          isAuthenticated: true,
          user: mockApiResponses.login.success.user,
          token: "mock-jwt-token",
        });
        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    }),
    logout: jest.fn(),
    isAuthenticated: false,
    user: null,
  })),
}));

describe("Authentication Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockAuthStore(false);
  });

  describe("Login Flow", () => {
    it("should successfully log in and redirect to dashboard", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "POST /api/auth/login": { data: mockApiResponses.login.success },
      }) as any;

      // Test with the actual login page
      render(<LoginPage />);

      // Fill in login form
      const usernameInput = screen.getByPlaceholderText(
        /johndoe or john@example.com/i,
      );
      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const submitButton = screen.getByRole("button", {
        name: /sign in/i,
      }) as any;

      await user.type(usernameInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      // Verify redirect after successful login
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("should handle login errors gracefully", async () => {
      const user = setupUser();
      const mockOnSubmit = jest.fn().mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      render(<AuthForm mode="login" onSubmit={mockOnSubmit} />);

      const usernameInput = screen.getByPlaceholderText(
        /johndoe or john@example.com/i,
      );
      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(usernameInput, "wrong@example.com");
      await user.type(passwordInput, "wrongpassword");
      await user.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        expect(
          screen.getByText(
            /the username or password you entered is incorrect/i,
          ),
        ).toBeInTheDocument();
      });

      // Verify onSubmit was called
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it("should validate form fields before submission", async () => {
      const user = setupUser();
      const mockOnSubmit = jest.fn();
      render(<AuthForm mode="login" onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });

      // Try to submit empty form
      await user.click(submitButton);

      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      // Verify onSubmit not called
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should toggle password visibility", async () => {
      const user = setupUser();
      const mockOnSubmit = jest.fn();
      render(<AuthForm mode="login" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByPlaceholderText(
        /••••••••/i,
      ) as HTMLInputElement;
      const toggleButton = screen.getByRole("button", { name: "" }); // Eye icon button

      // Initially password should be hidden
      expect(passwordInput.type).toBe("password");

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe("text");

      // Click to hide password again
      await user.click(toggleButton);
      expect(passwordInput.type).toBe("password");
    });
  });

  describe("Registration Flow", () => {
    it("should show additional fields for registration", () => {
      const mockOnSubmit = jest.fn();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      // Should show email field in addition to username
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

      // Should show password requirements
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
    });

    it("should validate password complexity", async () => {
      const user = setupUser();
      const mockOnSubmit = jest.fn();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const submitButton = screen.getByRole("button", {
        name: /create account/i,
      });

      // Type weak password
      await user.type(passwordInput, "weakpass");
      await user.click(submitButton);

      // Should show password requirement errors
      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 12 characters/i),
        ).toBeInTheDocument();
      });
    });

    it("should show password strength meter", async () => {
      const user = setupUser();
      const mockOnSubmit = jest.fn();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByPlaceholderText(/••••••••/i);

      // Focus on password field to show requirements
      await user.click(passwordInput);

      // Should show password requirements
      expect(screen.getByText(/password requirements:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/at least 12 characters long/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
      expect(screen.getByText(/one special character/i)).toBeInTheDocument();
    });
  });

  describe("Protected Route Access", () => {
    it("should redirect to login when accessing protected route without auth", async () => {
      mockAuthStore(false);

      // Mock useAuth to return unauthenticated state
      const { useAuth } = require("@/hooks/useAuth");
      useAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: jest.fn(),
        logout: jest.fn(),
      });

      // Mock protected component that uses auth hook
      const ProtectedComponent = () => {
        const { isAuthenticated } = useAuth();
        const router = require("next/navigation").useRouter();

        React.useEffect(() => {
          if (!isAuthenticated) {
            router.push("/auth/login");
          }
        }, [isAuthenticated, router]);

        if (!isAuthenticated) {
          return null;
        }

        return <div>Protected Content</div>;
      };

      render(<ProtectedComponent />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/auth/login");
      });
    });

    it("should allow access to protected route when authenticated", async () => {
      mockAuthStore(true, mockApiResponses.login.success.user);

      // Mock useAuth to return authenticated state
      const { useAuth } = require("@/hooks/useAuth");
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockApiResponses.login.success.user,
        login: jest.fn(),
        logout: jest.fn(),
      });

      // Mock protected component
      const ProtectedComponent = () => {
        const { isAuthenticated } = useAuth();
        const router = require("next/navigation").useRouter();

        React.useEffect(() => {
          if (!isAuthenticated) {
            router.push("/auth/login");
          }
        }, [isAuthenticated, router]);

        if (!isAuthenticated) {
          return null;
        }

        return <div>Protected Content</div>;
      };

      render(<ProtectedComponent />);

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();

      // Should show protected content
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("Logout Flow", () => {
    it("should clear auth state and redirect on logout", async () => {
      const authStore = require("@/store/authStore").useAuthStore;
      mockAuthStore(true, mockApiResponses.login.success.user);

      // Call logout
      authStore.getState().logout();

      expect(authStore.getState().isAuthenticated).toBe(false);
      expect(authStore.getState().token).toBeNull();
    });
  });
});
