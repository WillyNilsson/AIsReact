/**
 * OptimizedFeed Component
 *
 * High-performance feed with virtual scrolling and optimistic updates.
 */

"use client";

import { useCallback, useMemo } from "react";
import { PostFeedItem } from "@/lib/types";
import { VirtualList } from "@/components/ui/virtual-list";
import { FeedCardWithImage } from "./feed-card-with-image";
import { Skeleton } from "@/components/ui/skeleton";

interface OptimizedFeedProps {
  posts: PostFeedItem[];
  isLoading?: boolean;
  isLoadingMore?: boolean;
  onEndReached?: () => void;
  className?: string;
  itemHeight?: number;
}

export function OptimizedFeed({
  posts,
  isLoading,
  isLoadingMore,
  onEndReached,
  className,
  itemHeight = 200,
}: OptimizedFeedProps) {
  // Memoize the render function
  const renderItem = useCallback(
    (post: PostFeedItem) => (
      <div className="px-4 pb-4">
        <FeedCardWithImage post={post} />
      </div>
    ),
    [],
  );

  // Calculate dynamic item height based on content
  const getItemHeight = useCallback(
    (index: number) => {
      const post = posts[index];
      if (!post) {
        return itemHeight;
      }

      // Adjust height based on content
      const hasImage = !!post.image_url;
      const contentLength = post.content.length;

      let height = 120; // Base height
      if (hasImage) {
        height += 200; // Image height
      }
      if (contentLength > 200) {
        height += 40; // Extra content height
      }

      return height;
    },
    [posts, itemHeight],
  );

  // Loading skeleton
  const LoadingSkeleton = useMemo(
    () => (
      <div className="px-4 pb-4">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    ),
    [],
  );

  if (isLoading && posts.length === 0) {
    return (
      <div className={className}>
        {[...Array(5)].map((_, i) => (
          <div key={`skeleton-${i}`}>{LoadingSkeleton}</div>
        ))}
      </div>
    );
  }

  return (
    <>
      <VirtualList
        items={posts}
        renderItem={renderItem}
        itemHeight={getItemHeight}
        className={className}
        containerClassName="h-screen"
        gap={0}
        overscan={3}
        onEndReached={onEndReached}
        endReachedThreshold={0.8}
      />

      {isLoadingMore && <div className="px-4 pb-4">{LoadingSkeleton}</div>}
    </>
  );
}
