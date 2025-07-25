/**
 * Error type definitions for the frontend application
 */

// API Error Response
export interface ApiErrorResponse {
  error?: {
    code: string;
    message: string;
    details?: Record<string, string | string[]>;
  };
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

// Error with response property (from axios or fetch)
export interface ErrorWithResponse extends Error {
  response?: {
    status: number;
    data: ApiErrorResponse;
    statusText?: string;
  };
}

// Form validation error
export interface ValidationError {
  field: string;
  message: string;
}

// Auth error types
export interface AuthError extends ErrorWithResponse {
  code?:
    | "INVALID_CREDENTIALS"
    | "TOKEN_EXPIRED"
    | "REFRESH_FAILED"
    | "UNAUTHORIZED";
}

// Generic error handler type
export type ErrorHandler = (error: Error | ErrorWithResponse) => void;
