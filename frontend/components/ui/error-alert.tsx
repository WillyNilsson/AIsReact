/**
 * Error Alert Component
 *
 * Displays error messages with recovery suggestions and retry functionality.
 */

import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatErrorForDisplay } from "@/lib/errors/messages";

interface ErrorAlertProps {
  error: string | Error | unknown;
  context?: {
    action?: "login" | "register" | "upload" | "submit" | "verify" | "update";
    field?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  error,
  context,
  onRetry,
  onDismiss,
  className = "",
}: ErrorAlertProps) {
  const { message, suggestions, isRetryable } = formatErrorForDisplay(
    error,
    context,
  );

  return (
    <Alert variant="error" className={`relative ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <AlertDescription className="font-medium">{message}</AlertDescription>

          {suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                Try these steps:
              </p>
              <ul className="text-sm text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {isRetryable && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-8"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Alert>
  );
}
