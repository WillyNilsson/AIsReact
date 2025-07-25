"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { logError, LogContext } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: "page" | "section" | "component";
  context?: LogContext;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
    };

    // Bind methods
    this.resetError = this.resetError.bind(this);
    this.scheduleReset = this.scheduleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, context, level = "component" } = this.props;

    // Log error with context
    logError(`Error caught by ${level} boundary`, error, {
      ...context,
      errorBoundaryLevel: level,
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount + 1,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    this.setState({
      errorInfo,
      errorCount: this.state.errorCount + 1,
    });

    // Auto-reset after multiple errors (circuit breaker pattern)
    if (this.state.errorCount >= 3) {
      this.scheduleReset(5000);
    }
  }

  override componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset on prop changes if enabled
    if (
      hasError &&
      resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.resetError();
    }

    // Reset when resetKeys change
    if (resetKeys && hasError) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.previousResetKeys[index],
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }

    this.previousResetKeys = resetKeys || [];
  }

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset(delay: number) {
    this.resetTimeoutId = setTimeout(() => {
      this.resetError();
    }, delay);
  }

  resetError() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  }

  override render() {
    const { hasError, error, errorInfo, errorCount, showDetails } = this.state;
    const { children, fallback, isolate, level = "component" } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.resetError);
      }

      // Default error UI based on level
      if (level === "page") {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <Card className="max-w-2xl w-full p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="p-4 rounded-full bg-red-100 dark:bg-red-950/20">
                  <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-500" />
                </div>

                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Something went wrong
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    An unexpected error occurred. The error has been logged.
                  </p>

                  {errorCount > 2 && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Multiple errors detected. The page will auto-refresh in
                        a few seconds.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="w-full space-y-4">
                  <button
                    onClick={() =>
                      this.setState({ showDetails: !this.state.showDetails })
                    }
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-sm font-medium">Error Details</span>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 space-y-3 text-left">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Error Message
                        </p>
                        <p className="text-sm font-mono mt-1">
                          {error.message}
                        </p>
                      </div>

                      {process.env.NODE_ENV === "development" && errorInfo && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Component Stack
                          </p>
                          <pre className="text-xs mt-1 overflow-auto max-h-40">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 w-full max-w-sm">
                  <Button onClick={this.resetError} className="flex-1 gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Try again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => (window.location.href = "/")}
                    className="flex-1 gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Go home
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
      }

      // Section or component level error
      return (
        <div className={`${isolate ? "contents" : "p-4"}`}>
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {level === "section" ? "This section" : "This component"}{" "}
                encountered an error
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={this.resetError}
                className="ml-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}

// Hook for error handling in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    logError("Error caught by useErrorHandler", error, {
      componentStack: errorInfo?.componentStack,
    });

    // Re-throw to let error boundary catch it
    throw error;
  };
}
