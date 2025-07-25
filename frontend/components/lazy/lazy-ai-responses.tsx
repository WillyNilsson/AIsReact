import React, { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AIResponse } from "@/lib/types";
import { logger } from "@/lib/logger";

// Loading component
const AIResponsesLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  </div>
);

// Lazy load the AI responses view using React.lazy
const AIResponsesViewLazy = lazy(() =>
  import("@/components/ai/ai-responses-view").then((module) => {
    if (!module.AIResponsesView) {
      logger.error("AIResponsesView not found in module", module);
      throw new Error("AIResponsesView export not found");
    }
    return { default: module.AIResponsesView };
  }),
);

interface LazyAIResponsesViewProps {
  responses: AIResponse[];
  isLoading?: boolean;
  onRefresh?: () => void;
  postId?: number;
  showProgress?: boolean;
}

// Error boundary component
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("LazyAIResponsesView error", error, { errorInfo });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">Failed to load AI responses view</p>
          <p className="text-sm text-gray-500">
            {this.state.error?.message || "Unknown error"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export wrapper component with Suspense and error boundary
export function LazyAIResponsesView(props: LazyAIResponsesViewProps) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<AIResponsesLoading />}>
        <AIResponsesViewLazy {...props} />
      </Suspense>
    </LazyErrorBoundary>
  );
}
