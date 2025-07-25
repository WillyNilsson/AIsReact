"use client";

import React, { ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { AsyncErrorBoundary } from "@/components/error-boundary/async-error-boundary";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import logger from "@/lib/logger";

interface Props {
  children: ReactNode;
}

export function ErrorBoundaryProvider({ children }: Props) {
  const router = useRouter();

  const handleReset = () => {
    // Clear any cached data
    if (typeof window !== "undefined") {
      // Clear session storage
      sessionStorage.clear();

      // Reload the page
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const renderErrorFallback = (error: Error, resetError: () => void) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <Card className="max-w-lg w-full p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          <div className="p-5 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/20 dark:to-red-900/20 animate-pulse">
            <AlertCircle className="w-14 h-14 text-red-600 dark:text-red-500" />
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              Oops! Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-md">
              We encountered an unexpected error. Don&apos;t worry, we&apos;ve
              logged this issue and our team will look into it.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button
              onClick={() => {
                resetError();
                handleReset();
              }}
              className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={handleGoHome}
              className="flex-1 gap-2 border-gray-300 dark:border-gray-700"
            >
              <Home className="w-4 h-4" />
              Go home
            </Button>
          </div>

          {process.env.NODE_ENV === "development" && (
            <details className="w-full mt-6">
              <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                Error details (development only)
              </summary>
              <div className="mt-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-3 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-48">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      fallback={renderErrorFallback}
      onError={(error, errorInfo) => {
        // In production, you might want to send this to an error tracking service
        if (process.env.NODE_ENV === "production") {
          // Send to error tracking service
          logger.error("Application error:", { error, errorInfo });
        }
      }}
    >
      <AsyncErrorBoundary
        fallback={renderErrorFallback}
        onError={(error) => {
          // Handle async errors
          logger.error("Async error:", { error });
        }}
      >
        {children}
      </AsyncErrorBoundary>
    </ErrorBoundary>
  );
}
