/**
 * useError Hook
 *
 * Provides error handling utilities for components
 */

import { useState, useCallback } from "react";
import { logError, LogContext } from "@/lib/logger";
import { ErrorWithResponse } from "@/lib/types/errors";

export type ErrorType =
  | "network"
  | "server"
  | "permission"
  | "notFound"
  | "timeout"
  | "validation"
  | "unknown";

interface UseErrorOptions {
  context?: LogContext;
  resetOnSuccess?: boolean;
  onError?: (error: Error, type: ErrorType) => void;
}

interface UseErrorReturn {
  error: Error | null;
  errorType: ErrorType | null;
  errorMessage: string | null;
  isError: boolean;
  setError: (error: Error | unknown) => void;
  clearError: () => void;
  handleError: (error: unknown) => void;
  withErrorHandling: <T>(fn: () => Promise<T>) => Promise<T | null>;
}

export function useError(options: UseErrorOptions = {}): UseErrorReturn {
  const { context, resetOnSuccess = true, onError } = options;

  const [error, setErrorState] = useState<Error | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const determineErrorType = useCallback((error: unknown): ErrorType => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes("network") || message.includes("fetch")) {
        return "network";
      }

      // Timeout errors
      if (message.includes("timeout")) {
        return "timeout";
      }

      // Permission errors
      if (
        message.includes("permission") ||
        message.includes("forbidden") ||
        message.includes("unauthorized")
      ) {
        return "permission";
      }

      // Not found errors
      if (message.includes("not found") || message.includes("404")) {
        return "notFound";
      }

      // Validation errors
      if (message.includes("validation") || message.includes("invalid")) {
        return "validation";
      }
    }

    // Check HTTP status codes for ErrorWithResponse
    const errorWithResponse = error as ErrorWithResponse;
    if (errorWithResponse.response?.status) {
      const status = errorWithResponse.response.status;

      if (status === 404) {
        return "notFound";
      }
      if (status === 403 || status === 401) {
        return "permission";
      }
      if (status >= 500) {
        return "server";
      }
      if (status === 408) {
        return "timeout";
      }
      if (status === 400 || status === 422) {
        return "validation";
      }
    }

    return "unknown";
  }, []);

  const extractErrorMessage = useCallback((error: unknown): string => {
    // Handle ErrorWithResponse
    const errorWithResponse = error as ErrorWithResponse;
    if (errorWithResponse.response?.data) {
      const data = errorWithResponse.response.data;

      // Check for detail field
      if (data.detail) {
        return data.detail;
      }

      // Check for error object
      if (data.error?.message) {
        return data.error.message;
      }

      // Check for message field
      if (data.message) {
        return data.message;
      }
    }

    // Handle standard Error
    if (error instanceof Error) {
      return error.message;
    }

    // Handle string errors
    if (typeof error === "string") {
      return error;
    }

    return "An unexpected error occurred";
  }, []);

  const setError = useCallback(
    (error: Error | unknown) => {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);

      setErrorState(errorObj);
      setErrorType(type);
      setErrorMessage(message);

      // Log the error
      logError("Component error", errorObj, context);

      // Call custom error handler
      if (onError) {
        onError(errorObj, type);
      }
    },
    [context, determineErrorType, extractErrorMessage, onError],
  );

  const clearError = useCallback(() => {
    setErrorState(null);
    setErrorType(null);
    setErrorMessage(null);
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      setError(error);
    },
    [setError],
  );

  const withErrorHandling = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        if (resetOnSuccess) {
          clearError();
        }
        const result = await fn();
        return result;
      } catch (error) {
        handleError(error);
        return null;
      }
    },
    [clearError, handleError, resetOnSuccess],
  );

  return {
    error,
    errorType,
    errorMessage,
    isError: !!error,
    setError,
    clearError,
    handleError,
    withErrorHandling,
  };
}

// Hook for handling async operations with loading and error states
interface UseAsyncOptions extends UseErrorOptions {
  onSuccess?: () => void;
}

interface UseAsyncReturn<T> extends UseErrorReturn {
  data: T | null;
  isLoading: boolean;
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useAsync<T = unknown>(
  options: UseAsyncOptions = {},
): UseAsyncReturn<T> {
  const { onSuccess, ...errorOptions } = options;
  const errorHelpers = useError(errorOptions);

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      errorHelpers.clearError();

      try {
        const result = await fn();
        setData(result);

        if (onSuccess) {
          onSuccess();
        }

        return result;
      } catch (error) {
        errorHelpers.handleError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [errorHelpers, onSuccess],
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    errorHelpers.clearError();
  }, [errorHelpers]);

  return {
    ...errorHelpers,
    data,
    isLoading,
    execute,
    reset,
  };
}
