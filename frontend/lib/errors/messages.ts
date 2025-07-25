/**
 * Error Message Mapping
 *
 * Provides specific, actionable error messages for common error scenarios.
 * Maps error codes and patterns to user-friendly messages.
 */

export interface ErrorContext {
  action?: "login" | "register" | "upload" | "submit" | "verify" | "update";
  field?: string;
  details?: Record<string, unknown>;
}

// Common error patterns to specific messages
const ERROR_PATTERNS: Array<{
  pattern: RegExp | string;
  getMessage: (error: string, context?: ErrorContext) => string;
}> = [
  // Network errors
  {
    pattern: /network|ERR_NETWORK|ECONNREFUSED|fetch failed/i,
    getMessage: () =>
      "Unable to connect to the server. Please check your internet connection and try again.",
  },
  {
    pattern: /timeout|timed out/i,
    getMessage: () =>
      "The request took too long to complete. Please try again.",
  },

  // Authentication errors
  {
    pattern:
      /invalid.*credentials|authentication.*failed|invalid.*username.*password/i,
    getMessage: () =>
      "The username or password you entered is incorrect. Please try again.",
  },
  {
    pattern: /account.*locked|too many.*attempts/i,
    getMessage: () =>
      "Your account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes or reset your password.",
  },
  {
    pattern: /email.*not.*verified/i,
    getMessage: () =>
      "Please verify your email address before logging in. Check your inbox for the verification link.",
  },
  {
    pattern: /username.*taken|username.*exists/i,
    getMessage: () =>
      "This username is already taken. Please choose a different one.",
  },
  {
    pattern: /email.*already.*registered|email.*exists/i,
    getMessage: () =>
      "An account with this email already exists. Please login or use a different email.",
  },

  // Session/Token errors
  {
    pattern: /token.*expired|session.*expired/i,
    getMessage: () =>
      "Your session has expired. Please log in again to continue.",
  },
  {
    pattern: /invalid.*token|unauthorized/i,
    getMessage: (_, context) => {
      if (context?.action === "verify") {
        return "This verification link is invalid or has expired. Please request a new one.";
      }
      return "Your session is invalid. Please log in again.";
    },
  },

  // Rate limiting
  {
    pattern: /rate.*limit|too.*many.*requests|429/i,
    getMessage: (error) => {
      // Try to extract retry time from error message
      const retryMatch = error.match(/(\d+)\s*(seconds?|minutes?|hours?)/i);
      if (retryMatch) {
        return `You are making too many requests. Please wait ${retryMatch[0]} before trying again.`;
      }
      return "You are making too many requests. Please slow down and try again in a few minutes.";
    },
  },

  // Upload errors
  {
    pattern: /file.*too.*large|size.*limit/i,
    getMessage: (error) => {
      const sizeMatch = error.match(/(\d+\.?\d*)\s*(MB|KB|GB)/i);
      if (sizeMatch) {
        return `File size (${sizeMatch[0]}) exceeds the maximum allowed size of 10MB. Please choose a smaller file.`;
      }
      return "File is too large. Maximum file size is 10MB.";
    },
  },
  {
    pattern: /invalid.*file.*type|unsupported.*format/i,
    getMessage: () =>
      "File type not supported. Please upload a JPEG, PNG, GIF, or WebP image.",
  },
  {
    pattern: /upload.*failed/i,
    getMessage: () =>
      "Failed to upload your image. Please check your connection and try again.",
  },

  // Validation errors
  {
    pattern: /required.*field|field.*required/i,
    getMessage: (_, context) => {
      if (context?.field) {
        return `${
          context.field.charAt(0).toUpperCase() + context.field.slice(1)
        } is required.`;
      }
      return "Please fill in all required fields.";
    },
  },
  {
    pattern: /invalid.*email/i,
    getMessage: () =>
      "Please enter a valid email address (e.g., name@example.com).",
  },
  {
    pattern: /invalid.*url/i,
    getMessage: () =>
      "Please enter a valid URL starting with http:// or https://.",
  },
  {
    pattern: /password.*weak|password.*simple/i,
    getMessage: () =>
      "Password is too weak. It must be at least 12 characters with uppercase, lowercase, numbers, and special characters.",
  },

  // Permission errors
  {
    pattern: /permission.*denied|forbidden|403/i,
    getMessage: (_, context) => {
      if (context?.action === "verify") {
        return "You do not have permission to verify posts. Only verified users can participate in verification.";
      }
      if (context?.action === "submit") {
        return "You need to verify your email address before submitting posts.";
      }
      return "You do not have permission to perform this action.";
    },
  },

  // Resource errors
  {
    pattern: /not.*found|404/i,
    getMessage: (_, context) => {
      if (context?.action === "update") {
        return "The content you are trying to update no longer exists.";
      }
      return "The requested content could not be found. It may have been removed.";
    },
  },

  // Server errors
  {
    pattern: /server.*error|internal.*error|500/i,
    getMessage: () =>
      "Something went wrong on our end. Our team has been notified. Please try again later.",
  },
  {
    pattern: /maintenance|503/i,
    getMessage: () =>
      "The service is temporarily unavailable for maintenance. Please check back in a few minutes.",
  },

  // Content moderation
  {
    pattern: /inappropriate.*content|policy.*violation/i,
    getMessage: () =>
      "Your submission contains content that violates our community guidelines. Please review and modify your content.",
  },
  {
    pattern: /spam.*detected/i,
    getMessage: () =>
      "Your submission was flagged as potential spam. Please ensure your content is relevant and original.",
  },
];

// Field-specific error messages
const FIELD_ERRORS: Record<string, Record<string, string>> = {
  username: {
    required: "Username is required.",
    minLength: "Username must be at least 3 characters long.",
    maxLength: "Username must be less than 30 characters.",
    pattern:
      "Username can only contain letters, numbers, underscores, and hyphens.",
    taken: "This username is already taken. Please choose another.",
  },
  email: {
    required: "Email address is required.",
    invalid: "Please enter a valid email address.",
    taken: "An account with this email already exists.",
  },
  password: {
    required: "Password is required.",
    minLength: "Password must be at least 12 characters long.",
    weak: "Password must include uppercase, lowercase, numbers, and special characters.",
    mismatch: "Passwords do not match.",
    incorrect: "Current password is incorrect.",
  },
  title: {
    required: "Title is required.",
    minLength: "Title must be at least 5 characters long.",
    maxLength: "Title must be less than 200 characters.",
  },
  content: {
    required: "Content is required.",
    minLength: "Content must be at least 10 characters long.",
    maxLength: "Content exceeds the maximum length of 10,000 characters.",
  },
  source_url: {
    required: "Source URL is required.",
    invalid: "Please enter a valid URL starting with http:// or https://.",
  },
};

/**
 * Get a specific, actionable error message based on the error and context
 */
export function getErrorMessage(
  error: string | Error | unknown,
  context?: ErrorContext,
): string {
  // Handle Error objects
  if (error instanceof Error) {
    error = error.message;
  }

  // Convert to string
  const errorStr = String(error);

  // Check field-specific errors if field is provided
  if (context?.field && FIELD_ERRORS[context.field]) {
    const fieldErrors = FIELD_ERRORS[context.field];
    for (const [key, message] of Object.entries(fieldErrors)) {
      if (errorStr.toLowerCase().includes(key.toLowerCase())) {
        return message;
      }
    }
  }

  // Check error patterns
  for (const { pattern, getMessage } of ERROR_PATTERNS) {
    if (
      typeof pattern === "string"
        ? errorStr.includes(pattern)
        : pattern.test(errorStr)
    ) {
      return getMessage(errorStr, context);
    }
  }

  // Context-specific fallbacks
  if (context?.action) {
    switch (context.action) {
      case "login":
        return "Unable to sign in. Please check your credentials and try again.";
      case "register":
        return "Unable to create your account. Please check your information and try again.";
      case "upload":
        return "Unable to upload your file. Please try again.";
      case "submit":
        return "Unable to submit your post. Please try again.";
      case "verify":
        return "Unable to submit your verification vote. Please try again.";
      case "update":
        return "Unable to save your changes. Please try again.";
    }
  }

  // Generic fallback
  return "An unexpected error occurred. Please try again or contact support if the problem persists.";
}

/**
 * Get recovery suggestions based on error type
 */
export function getErrorRecoverySuggestions(error: string | Error): string[] {
  const errorStr = error instanceof Error ? error.message : String(error);
  const suggestions: string[] = [];

  if (/network|connection|offline/i.test(errorStr)) {
    suggestions.push("Check your internet connection");
    suggestions.push("Try refreshing the page");
    suggestions.push("Check if the service is available");
  } else if (/rate.*limit|too.*many/i.test(errorStr)) {
    suggestions.push("Wait a few minutes before trying again");
    suggestions.push("Reduce the frequency of your requests");
  } else if (/session.*expired|token.*expired/i.test(errorStr)) {
    suggestions.push("Log in again to continue");
  } else if (/permission|forbidden/i.test(errorStr)) {
    suggestions.push("Check if you have the required permissions");
    suggestions.push("Contact support if you believe this is an error");
  } else if (/server.*error|500/i.test(errorStr)) {
    suggestions.push("Wait a few minutes and try again");
    suggestions.push("Contact support if the issue persists");
  }

  return suggestions;
}

/**
 * Format error for display with optional details
 */
export function formatErrorForDisplay(
  error: unknown,
  context?: ErrorContext,
): {
  message: string;
  suggestions: string[];
  isRetryable: boolean;
} {
  const message = getErrorMessage(error, context);
  const suggestions = getErrorRecoverySuggestions(
    error instanceof Error ? error : String(error),
  );

  // Determine if error is retryable
  const errorStr = error instanceof Error ? error.message : String(error);
  const isRetryable =
    /network|timeout|server.*error|500|503/i.test(errorStr) &&
    !/rate.*limit|429/i.test(errorStr);

  return {
    message,
    suggestions,
    isRetryable,
  };
}
