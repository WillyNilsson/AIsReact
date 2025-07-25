"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { logError } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    // Error logged to error reporting service
    // In production, this would be sent to Sentry or similar
    logError("Application error:", error, { digest: error.digest });
  }, [error]);

  const handleRetry = () => {
    setAttemptCount((prev) => prev + 1);
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-lg w-full p-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="p-5 rounded-full bg-red-100 dark:bg-red-950/20 animate-pulse">
            <AlertCircle className="w-14 h-14 text-red-600 dark:text-red-500" />
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We're sorry for the inconvenience. The error has been logged and
              our team will investigate.
            </p>

            {attemptCount > 2 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Multiple retry attempts detected. The issue might persist.
                  Please try again later or contact support.
                </p>
              </div>
            )}
          </div>

          {/* Error Details Section */}
          <div className="w-full">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Error Details
              </span>
              {showDetails ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {showDetails && (
              <div className="mt-2 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Error Message
                  </p>
                  <p className="text-sm font-mono break-all text-gray-700 dark:text-gray-300">
                    {error.message || "Unknown error occurred"}
                  </p>
                </div>

                {error.digest && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Error ID
                    </p>
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                      {error.digest}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Timestamp
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-3 pt-4">
            <div className="flex gap-3">
              <Button
                onClick={handleRetry}
                className="flex-1 gap-2"
                disabled={attemptCount > 5}
              >
                <RefreshCw className="w-4 h-4" />
                {attemptCount > 0 ? `Retry (${attemptCount})` : "Try again"}
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="w-4 h-4" />
                  Go home
                </Button>
              </Link>
            </div>

            {attemptCount > 2 && (
              <a
                href={`mailto:support@aisreact.com?subject=Error%20Report&body=Error%20ID:%20${
                  error.digest || "unknown"
                }`}
                className="block"
              >
                <Button variant="ghost" className="w-full gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  Contact Support
                </Button>
              </a>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
