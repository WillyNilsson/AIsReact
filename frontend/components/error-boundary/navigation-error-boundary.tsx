"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import logger from "@/lib/logger";

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class NavigationErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Navigation error caught by boundary:", error, { errorInfo });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent error={this.state.error!} reset={this.reset} />
        );
      }

      return (
        <DefaultErrorFallback error={this.state.error!} reset={this.reset} />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            We encountered an error while loading this page. This might be a
            temporary issue.
          </p>

          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <summary className="cursor-pointer font-medium">
                Error details
              </summary>
              <pre className="mt-2 text-sm text-gray-700 dark:text-gray-300 overflow-auto">
                {error.message}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 mt-6">
            <Button onClick={reset} variant="primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => router.push("/")} variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
