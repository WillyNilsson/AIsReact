import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "../auth-form";

describe("AuthForm", () => {
  const mockOnSubmit = jest.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe("Password Requirements Visibility", () => {
    it("shows password requirements when password field is focused during registration", async () => {
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);

      // Requirements should not be visible initially
      expect(
        screen.queryByText("Password requirements:"),
      ).not.toBeInTheDocument();

      // Focus the password field
      fireEvent.focus(passwordInput);

      // Requirements should now be visible
      expect(screen.getByText("Password requirements:")).toBeInTheDocument();
      expect(
        screen.getByText("At least 12 characters long"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("One uppercase letter (A-Z)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("One lowercase letter (a-z)"),
      ).toBeInTheDocument();
      expect(screen.getByText("One number (0-9)")).toBeInTheDocument();
      expect(
        screen.getByText("One special character (!@#$%^&*...)"),
      ).toBeInTheDocument();
    });

    it("hides password requirements when password field loses focus", async () => {
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);

      // Initially requirements should not be visible
      expect(
        screen.queryByText("Password requirements:"),
      ).not.toBeInTheDocument();

      // Focus the password field
      fireEvent.focus(passwordInput);
      expect(screen.getByText("Password requirements:")).toBeInTheDocument();

      // Blur the password field
      fireEvent.blur(passwordInput);

      // Wait for state update
      await waitFor(() => {
        expect(
          screen.queryByText("Password requirements:"),
        ).not.toBeInTheDocument();
      });
    });

    it("does not show password requirements in login mode", async () => {
      render(<AuthForm mode="login" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);

      // Focus the password field
      fireEvent.focus(passwordInput);

      // Requirements should not be visible in login mode
      expect(
        screen.queryByText("Password requirements:"),
      ).not.toBeInTheDocument();
    });

    it("shows password strength meter when typing in registration mode", async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);

      // Type a password
      await user.type(passwordInput, "Test123!@#");

      // Password strength meter should be visible
      expect(screen.getByText("Password strength")).toBeInTheDocument();
      // Check that strength is calculated
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("maintains requirements visibility during typing", async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      const passwordInput = screen.getByLabelText(/password/i);

      // Focus and start typing
      fireEvent.focus(passwordInput);
      await user.type(passwordInput, "Test");

      // Requirements should still be visible while focused
      expect(screen.getByText("Password requirements:")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("validates password complexity in registration mode", async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      // Fill in required fields
      await user.type(screen.getByLabelText(/username/i), "testuser");
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "weak");

      // Submit form
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 12 characters/i),
        ).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("accepts valid password in registration mode", async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="register" onSubmit={mockOnSubmit} />);

      // Fill in all fields with valid data
      await user.type(screen.getByLabelText(/username/i), "testuser");
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "ValidPass123!@#");

      // Submit form
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Should submit successfully
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          username: "testuser",
          email: "test@example.com",
          password: "ValidPass123!@#",
        });
      });
    });
  });
});
