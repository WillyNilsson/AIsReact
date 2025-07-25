/**
 * Tests for Error Message Mapping
 */

import {
  getErrorMessage,
  getErrorRecoverySuggestions,
  formatErrorForDisplay,
} from "../messages";

describe("getErrorMessage", () => {
  describe("Network errors", () => {
    it("should return specific message for network errors", () => {
      const errors = [
        "network error",
        "ERR_NETWORK",
        "ECONNREFUSED",
        "fetch failed",
      ];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "Unable to connect to the server. Please check your internet connection and try again.",
        );
      });
    });

    it("should return specific message for timeout errors", () => {
      const errors = ["timeout", "request timed out", "operation timed out"];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "The request took too long to complete. Please try again.",
        );
      });
    });
  });

  describe("Authentication errors", () => {
    it("should return specific message for invalid credentials", () => {
      const errors = [
        "invalid credentials",
        "authentication failed",
        "Invalid username or password",
      ];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "The username or password you entered is incorrect. Please try again.",
        );
      });
    });

    it("should return specific message for account locked", () => {
      const errors = [
        "account locked",
        "too many attempts",
        "Too many failed login attempts",
      ];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "Your account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes or reset your password.",
        );
      });
    });

    it("should return specific message for email not verified", () => {
      const message = getErrorMessage("email not verified");
      expect(message).toBe(
        "Please verify your email address before logging in. Check your inbox for the verification link.",
      );
    });

    it("should return specific message for username taken", () => {
      const errors = ["username taken", "username already exists"];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "This username is already taken. Please choose a different one.",
        );
      });
    });
  });

  describe("Session/Token errors", () => {
    it("should return specific message for session expired", () => {
      const errors = [
        "token expired",
        "session expired",
        "Your session has expired",
      ];
      errors.forEach((error) => {
        const message = getErrorMessage(error);
        expect(message).toBe(
          "Your session has expired. Please log in again to continue.",
        );
      });
    });

    it("should return context-specific message for invalid token", () => {
      const message = getErrorMessage("invalid token", { action: "verify" });
      expect(message).toBe(
        "This verification link is invalid or has expired. Please request a new one.",
      );
    });
  });

  describe("Rate limiting", () => {
    it("should extract retry time from error message", () => {
      const message = getErrorMessage(
        "rate limit exceeded. Try again in 60 seconds",
      );
      expect(message).toBe(
        "You are making too many requests. Please wait 60 seconds before trying again.",
      );
    });

    it("should provide generic rate limit message without time", () => {
      const message = getErrorMessage("429 too many requests");
      expect(message).toBe(
        "You are making too many requests. Please slow down and try again in a few minutes.",
      );
    });
  });

  describe("Upload errors", () => {
    it("should handle file size errors with size info", () => {
      const message = getErrorMessage("File size 15.5MB exceeds limit");
      expect(message).toBe(
        "File size (15.5MB) exceeds the maximum allowed size of 10MB. Please choose a smaller file.",
      );
    });

    it("should handle invalid file type errors", () => {
      const message = getErrorMessage("invalid file type");
      expect(message).toBe(
        "File type not supported. Please upload a JPEG, PNG, GIF, or WebP image.",
      );
    });
  });

  describe("Field-specific errors", () => {
    it("should return field-specific error for username", () => {
      const message = getErrorMessage("minLength", { field: "username" });
      expect(message).toBe("Username must be at least 3 characters long.");
    });

    it("should return field-specific error for email", () => {
      const message = getErrorMessage("invalid", { field: "email" });
      expect(message).toBe("Please enter a valid email address.");
    });

    it("should return field-specific error for password", () => {
      const message = getErrorMessage("weak", { field: "password" });
      expect(message).toBe(
        "Password must include uppercase, lowercase, numbers, and special characters.",
      );
    });
  });

  describe("Permission errors", () => {
    it("should return context-specific permission error for verify", () => {
      const message = getErrorMessage("permission denied", {
        action: "verify",
      });
      expect(message).toBe(
        "You do not have permission to verify posts. Only verified users can participate in verification.",
      );
    });

    it("should return context-specific permission error for submit", () => {
      const message = getErrorMessage("403 forbidden", { action: "submit" });
      expect(message).toBe(
        "You need to verify your email address before submitting posts.",
      );
    });
  });

  describe("Fallback messages", () => {
    it("should return action-specific fallback for unknown errors", () => {
      const message = getErrorMessage("some random error", { action: "login" });
      expect(message).toBe(
        "Unable to sign in. Please check your credentials and try again.",
      );
    });

    it("should return generic fallback for completely unknown errors", () => {
      const message = getErrorMessage("xyz123 unknown error");
      expect(message).toBe(
        "An unexpected error occurred. Please try again or contact support if the problem persists.",
      );
    });
  });

  describe("Error object handling", () => {
    it("should handle Error objects", () => {
      const error = new Error("network error");
      const message = getErrorMessage(error);
      expect(message).toBe(
        "Unable to connect to the server. Please check your internet connection and try again.",
      );
    });
  });
});

describe("getErrorRecoverySuggestions", () => {
  it("should provide network error suggestions", () => {
    const suggestions = getErrorRecoverySuggestions("network error");
    expect(suggestions).toContain("Check your internet connection");
    expect(suggestions).toContain("Try refreshing the page");
    expect(suggestions).toContain("Check if the service is available");
  });

  it("should provide rate limit suggestions", () => {
    const suggestions = getErrorRecoverySuggestions("rate limit exceeded");
    expect(suggestions).toContain("Wait a few minutes before trying again");
    expect(suggestions).toContain("Reduce the frequency of your requests");
  });

  it("should provide session expired suggestions", () => {
    const suggestions = getErrorRecoverySuggestions("session expired");
    expect(suggestions).toContain("Log in again to continue");
  });

  it("should provide permission error suggestions", () => {
    const suggestions = getErrorRecoverySuggestions("permission denied");
    expect(suggestions).toContain("Check if you have the required permissions");
    expect(suggestions).toContain(
      "Contact support if you believe this is an error",
    );
  });

  it("should provide server error suggestions", () => {
    const suggestions = getErrorRecoverySuggestions("500 server error");
    expect(suggestions).toContain("Wait a few minutes and try again");
    expect(suggestions).toContain("Contact support if the issue persists");
  });

  it("should return empty array for unknown errors", () => {
    const suggestions = getErrorRecoverySuggestions("unknown error xyz");
    expect(suggestions).toEqual([]);
  });
});

describe("formatErrorForDisplay", () => {
  it("should format error with message, suggestions, and retryable flag", () => {
    const result = formatErrorForDisplay("network error");
    expect(result.message).toBe(
      "Unable to connect to the server. Please check your internet connection and try again.",
    );
    expect(result.suggestions).toContain("Check your internet connection");
    expect(result.isRetryable).toBe(true);
  });

  it("should mark rate limit errors as non-retryable", () => {
    const result = formatErrorForDisplay("rate limit exceeded");
    expect(result.isRetryable).toBe(false);
  });

  it("should mark server errors as retryable", () => {
    const result = formatErrorForDisplay("500 internal server error");
    expect(result.isRetryable).toBe(true);
  });

  it("should handle context in formatting", () => {
    const result = formatErrorForDisplay("permission denied", {
      action: "verify",
    });
    expect(result.message).toBe(
      "You do not have permission to verify posts. Only verified users can participate in verification.",
    );
  });
});
