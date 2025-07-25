/**
 * VirtualList Component
 *
 * High-performance virtual scrolling for large lists.
 */

"use client";

import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number | ((index: number) => number);
  className?: string;
  containerClassName?: string;
  gap?: number;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 80,
  className,
  containerClassName,
  gap = 0,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        if (typeof itemHeight === "function") {
          return itemHeight(index);
        }
        return itemHeight;
      },
      [itemHeight],
    ),
    overscan,
    gap,
  });

  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onEndReached || scrollingRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage > endReachedThreshold) {
      scrollingRef.current = true;
      onEndReached();
      // Reset after a delay to prevent multiple calls
      setTimeout(() => {
        scrollingRef.current = false;
      }, 1000);
    }
  }, [onEndReached, endReachedThreshold]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "w-full h-full overflow-auto scrollbar-thin",
        containerClassName,
      )}
      onScroll={handleScroll}
    >
      <div
        className={cn("relative w-full", className)}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) {
            return null;
          }

          return (
            <div
              key={virtualItem.key}
              className="absolute inset-x-0"
              style={{
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook for easier virtual list usage
 */
export function useVirtualList<T>(
  items: T[],
  options?: Partial<VirtualListProps<T>>,
) {
  const defaultOptions: Partial<VirtualListProps<T>> = {
    itemHeight: 80,
    gap: 8,
    overscan: 5,
    endReachedThreshold: 0.8,
  };

  return {
    items,
    ...defaultOptions,
    ...options,
  };
}
