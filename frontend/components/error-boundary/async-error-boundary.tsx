"use client";

import React, { Component, ReactNode, useEffect } from "react";
import { ErrorBoundary } from "./error-boundary";
import logger from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

export class AsyncErrorBoundary extends Component<Props, State> {
  override state: State = {
    error: null,
  };

  resetError = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      // Throw to parent error boundary
      throw error;
    }

    return (
      <ErrorBoundary
        fallback={fallback}
        onError={(_error) => {
          // Reset our state when parent boundary catches
          this.setState({ error: null });
        }}
      >
        {children}
      </ErrorBoundary>
    );
  }
}

// Hook to catch unhandled promise rejections
function useAsyncErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error("Unhandled promise rejection:", event.reason);
      // Don't throw here, just log it
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);
}

// Async error boundary with Suspense support
export function AsyncBoundary({
  children,
  loadingFallback = <div>Loading...</div>,
  errorFallback,
  onError,
}: {
  children: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error) => void;
}) {
  // Use the hook to catch async errors
  useAsyncErrorHandler();

  return (
    <AsyncErrorBoundary fallback={errorFallback} onError={onError}>
      <React.Suspense fallback={loadingFallback}>{children}</React.Suspense>
    </AsyncErrorBoundary>
  );
}
