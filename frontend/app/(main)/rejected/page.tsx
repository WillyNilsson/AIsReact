/**
 * Rejected Posts Page
 *
 * Shows posts that were rejected by moderation with blurred content.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useRejectedFeed, useFeedData } from "@/hooks/useFeed";
import { PostStatus } from "@/lib/types";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { safeLocaleDateString } from "@/lib/utils/date";

export default function RejectedPostsPage() {
  const [showContent, setShowContent] = useState<Set<number>>(new Set());

  const rejectedFeedQuery = useRejectedFeed();
  const { posts, isEmpty, isReachingEnd } = useFeedData(rejectedFeedQuery);

  const {
    error,
    isLoading,
    fetchNextPage,
    isFetchingNextPage: isLoadingMore,
  } = rejectedFeedQuery;

  const { ref, inView } = useInView({
    threshold: 0,
  });

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore) {
      fetchNextPage();
    }
  }, [inView, isReachingEnd, isLoadingMore, fetchNextPage]);

  const toggleContentVisibility = useCallback((postId: number) => {
    setShowContent((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Rejected Content</h1>
        <Alert className="bg-yellow-950/20 border-yellow-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Content may include misinformation, inappropriate material, or
              policy violations.
            </p>
          </div>
        </Alert>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-950/20 border border-red-900/20 rounded-lg p-6 mb-6">
          <p className="text-red-400">
            Failed to load rejected posts. Please try again.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <RejectedPostSkeleton />
          <RejectedPostSkeleton />
          <RejectedPostSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No rejected posts to display. This is a good thing!
          </p>
        </Card>
      )}

      {/* Feed */}
      {!isLoading && !isEmpty && (
        <div className="space-y-6">
          {posts.map((post) => {
            const isVisible = showContent.has(post.id);

            return (
              <Card key={post.id} className="overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        Rejected Post #{post.id}
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
                          {PostStatus.REJECTED}
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        By {post.user?.username || "Unknown"} •{" "}
                        {safeLocaleDateString(post.created_at)}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleContentVisibility(post.id)}
                    >
                      {isVisible ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Show
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Rejection reason */}
                  <div className="mb-4 p-3 rounded-lg bg-red-900/10 border border-red-900/20">
                    <p className="text-sm">
                      <span className="text-red-400 font-medium">Reason:</span>
                      <span className="text-red-300/90 ml-1">
                        {post.rejection_reason || "Content violation"}
                      </span>
                    </p>
                  </div>

                  {/* Blurred/Hidden content */}
                  <div
                    className={`relative transition-all duration-300 ${
                      !isVisible ? "blur-xl select-none" : ""
                    }`}
                  >
                    {!isVisible && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-background/90 px-4 py-2 rounded-lg border">
                          <p className="text-sm text-muted-foreground">
                            Content hidden
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="font-medium">{post.title}</h4>

                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={isVisible ? post.source_url : "#"}
                          target={isVisible ? "_blank" : undefined}
                          rel={isVisible ? "noopener noreferrer" : undefined}
                          className={`text-sm ${
                            isVisible
                              ? "text-blue-600 hover:underline"
                              : "text-muted-foreground"
                          } truncate`}
                          onClick={
                            !isVisible ? (e) => e.preventDefault() : undefined
                          }
                        >
                          {post.source_url}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* View details link */}
                  <div className="mt-4 pt-4 border-t">
                    <Link href={`/posts/${post.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Load more trigger */}
          <div ref={ref} className="py-4">
            {isLoadingMore && (
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {isReachingEnd && posts.length > 0 && (
              <p className="text-center text-muted-foreground text-sm">
                No more rejected posts to load
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RejectedPostSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-20 w-full mb-4" />
      <Skeleton className="h-16 w-full opacity-50" />
    </Card>
  );
}
