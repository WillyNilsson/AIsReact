"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
  Wifi,
  Server,
  ShieldAlert,
  Clock,
  FileQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Error types for better UX
export type ErrorType =
  | "network"
  | "server"
  | "permission"
  | "notFound"
  | "timeout"
  | "validation"
  | "unknown";

interface BaseErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

// Inline error message (for form fields, etc.)
export function InlineError({
  message = "An error occurred",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-red-600 dark:text-red-400",
        className,
      )}
    >
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}

// Compact error alert
export function ErrorAlert({
  title = "Error",
  message = "Something went wrong",
  onRetry,
  variant = "error",
  className,
}: BaseErrorProps & {
  title?: string;
  variant?: "default" | "error" | "warning" | "success";
}) {
  return (
    <Alert variant={variant} className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="ml-4">
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Error card with icon and actions
export function ErrorCard({
  type = "unknown",
  title,
  message,
  details,
  onRetry,
  onGoHome,
  showDetails = false,
  className,
}: BaseErrorProps & {
  type?: ErrorType;
  title?: string;
  details?: string;
  onGoHome?: () => void;
  showDetails?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const errorConfig = {
    network: {
      icon: Wifi,
      title: "Connection Error",
      message:
        "Unable to connect to the server. Please check your internet connection.",
      color: "text-orange-600 dark:text-orange-400",
    },
    server: {
      icon: Server,
      title: "Server Error",
      message: "Our servers are experiencing issues. Please try again later.",
      color: "text-red-600 dark:text-red-400",
    },
    permission: {
      icon: ShieldAlert,
      title: "Permission Denied",
      message: "You don't have permission to access this resource.",
      color: "text-purple-600 dark:text-purple-400",
    },
    notFound: {
      icon: FileQuestion,
      title: "Not Found",
      message: "The requested resource could not be found.",
      color: "text-gray-600 dark:text-gray-400",
    },
    timeout: {
      icon: Clock,
      title: "Request Timeout",
      message: "The request took too long to complete. Please try again.",
      color: "text-yellow-600 dark:text-yellow-400",
    },
    validation: {
      icon: AlertCircle,
      title: "Validation Error",
      message: "Please check your input and try again.",
      color: "text-blue-600 dark:text-blue-400",
    },
    unknown: {
      icon: AlertCircle,
      title: "Something went wrong",
      message: "An unexpected error occurred. Please try again.",
      color: "text-red-600 dark:text-red-400",
    },
  };

  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <Card className={cn("p-6", className)}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div
          className={cn(
            "p-3 rounded-full bg-gray-100 dark:bg-gray-800",
            config.color,
          )}
        >
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title || config.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
            {message || config.message}
          </p>
        </div>

        {(details || showDetails) && (
          <div className="w-full">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <span>Details</span>
              {detailsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {detailsOpen && details && (
              <div className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-left">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                  {details}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {onRetry && (
            <Button onClick={onRetry} size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          )}
          {onGoHome && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGoHome}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Go home
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Full page error
export function FullPageError({
  type = "unknown",
  title,
  message,
  onRetry,
  onGoHome = () => (window.location.href = "/"),
  className,
}: BaseErrorProps & {
  type?: ErrorType;
  title?: string;
  onGoHome?: () => void;
}) {
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900",
        className,
      )}
    >
      <ErrorCard
        type={type}
        title={title}
        message={message}
        onRetry={onRetry}
        onGoHome={onGoHome}
        className="max-w-lg w-full"
      />
    </div>
  );
}

// Empty state with error
export function ErrorEmptyState({
  title = "No data available",
  message = "There was an error loading the content",
  icon: Icon = FileQuestion,
  onRetry,
  className,
}: BaseErrorProps & {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

// Error list item (for use in lists)
export function ErrorListItem({
  message = "Failed to load item",
  onRetry,
  className,
}: BaseErrorProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-700 dark:text-red-300">
          {message}
        </span>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
