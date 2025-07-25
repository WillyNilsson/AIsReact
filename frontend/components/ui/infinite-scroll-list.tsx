"use client";

import { useEffect, useRef, ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";

interface InfiniteScrollListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onLoadMore: () => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  emptyState?: ReactNode;
  className?: string;
  threshold?: number;
}

export function InfiniteScrollList<T>({
  items,
  renderItem,
  onLoadMore,
  isLoading = false,
  isLoadingMore = false,
  hasMore = true,
  emptyState,
  className = "space-y-6",
  threshold = 0.1,
}: InfiniteScrollListProps<T>) {
  const { ref, inView } = useInView({
    threshold,
    rootMargin: "100px",
  });

  // Track if we've already triggered load for current scroll position
  const loadingRef = useRef(false);

  useEffect(() => {
    if (
      inView &&
      hasMore &&
      !isLoadingMore &&
      !isLoading &&
      !loadingRef.current
    ) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [inView, hasMore, isLoadingMore, isLoading, onLoadMore]);

  // Reset loading ref when loading completes
  useEffect(() => {
    if (!isLoadingMore) {
      loadingRef.current = false;
    }
  }, [isLoadingMore]);

  // Initial loading state
  if (isLoading && items.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (!isLoading && items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className={className}>
        {items.map((item, index) => renderItem(item, index))}
      </div>

      {/* Load more trigger */}
      {items.length > 0 && (
        <div ref={ref} className="py-8">
          {isLoadingMore && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <p className="text-center text-muted-foreground text-sm">
              No more items to load
            </p>
          )}
        </div>
      )}
    </>
  );
}
