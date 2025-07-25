"use client";

import React, { ReactNode } from "react";
import { ErrorBoundary } from "./error-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionName: string;
  fallbackMessage?: string;
  onError?: (error: Error) => void;
  showError?: boolean;
}

export function SectionBoundary({
  children,
  sectionName,
  fallbackMessage = "This section is temporarily unavailable",
  onError,
  showError = true,
}: Props) {
  return (
    <ErrorBoundary
      level="section"
      context={{ section: sectionName }}
      onError={(error, _errorInfo) => {
        if (onError) {
          onError(error);
        }
      }}
      fallback={(error, resetError) =>
        showError ? (
          <div className="p-4">
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>{fallbackMessage}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetError}
                    className="ml-4"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : null
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// List boundary for handling errors in list items
export function ListItemBoundary({
  children,
  itemId,
  fallback = (
    <div className="p-4 text-center text-gray-500">Failed to load item</div>
  ),
}: {
  children: ReactNode;
  itemId: string | number;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      level="component"
      resetKeys={[itemId]}
      context={{ itemId }}
      fallback={() => fallback}
      isolate
    >
      {children}
    </ErrorBoundary>
  );
}
