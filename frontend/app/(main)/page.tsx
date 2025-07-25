/**
 * Home Page
 *
 * Main feed page showing live posts.
 */

"use client";

import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { FeedCardWithImage } from "@/components/feed/feed-card-with-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveFeed, useFeedData } from "@/hooks/useFeed";
import { Loader2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MissionModal } from "@/components/ui/mission-modal";
import { CompactHero } from "@/components/ui/compact-hero";
import { useVoteSync } from "@/lib/hooks/useVoteSync";

export default function HomePage() {
  const [newPostIds, _setNewPostIds] = useState<Set<number>>(new Set());
  const [showMissionModal, setShowMissionModal] = useState(false);

  // Check if user has seen the mission modal before
  useEffect(() => {
    const hasSeenMission = localStorage.getItem("hasSeenMission");
    if (!hasSeenMission) {
      const timer = setTimeout(() => {
        setShowMissionModal(true);
        localStorage.setItem("hasSeenMission", "true");
      }, 1500); // Show after 1.5 seconds
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const feedQuery = useLiveFeed();
  const {
    posts,
    isEmpty,
    isReachingEnd,
    error,
    isLoading,
    isFetchingNextPage: isLoadingMore,
    fetchNextPage,
    refetch: _mutate,
    isRefetching: _isRefreshing,
  } = useFeedData(feedQuery);

  // Sync vote data from API
  useVoteSync(posts);

  // Subscribe to live feed updates - commented out for simpler solution
  // useFeedSubscription('live');

  // Handle new posts via WebSocket - commented out for simpler solution
  // useWebSocketEvent('post:created', (post) => {
  //   if (post.status === 'live' && !isEmpty) {
  //     // Add to new posts set for animation
  //     setNewPostIds(prev => new Set(prev).add(post.id));
  //     // Refresh the feed
  //     mutate();
  //     // Remove from new posts after animation
  //     setTimeout(() => {
  //       setNewPostIds(prev => {
  //         const next = new Set(prev);
  //         next.delete(post.id);
  //         return next;
  //       });
  //     }, 3000);
  //   }
  // });

  // Handle post status changes - commented out for simpler solution
  // useWebSocketEvent('post:statusChanged', (data) => {
  //   if (data.status === 'live' && !isEmpty) {
  //     // A post just went live, refresh feed
  //     mutate();
  //   }
  // });

  const { ref, inView } = useInView({
    threshold: 0,
  });

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore && !error) {
      fetchNextPage();
    }
  }, [inView, isReachingEnd, isLoadingMore, error, fetchNextPage]);

  // Ensure posts is always an array
  const safePosts = Array.isArray(posts) ? posts : [];

  return (
    <>
      {/* Mission Modal - rendered outside container for proper positioning */}
      <AnimatePresence>
        {showMissionModal && (
          <MissionModal
            isOpen={showMissionModal}
            onClose={() => setShowMissionModal(false)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <CompactHero onOpenMission={() => setShowMissionModal(true)} />
        </div>

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-950/10 backdrop-blur-xl border border-red-900/20 rounded-2xl p-6 mb-6"
          >
            <p className="text-red-400 font-medium">
              Failed to load posts. Please try again.
            </p>
          </motion.div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <FeedCardSkeleton />
            <FeedCardSkeleton />
            <FeedCardSkeleton />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isEmpty && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-gray-900/30 to-gray-900/50 backdrop-blur-xl rounded-3xl" />
            <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-800/50 p-12">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700">
                  <FileText className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-300">
                  No posts yet
                </h3>
                <p className="text-gray-500 max-w-md">
                  Be the first to submit a post and see how different AI models
                  analyze current events.
                </p>
                <Link href="/submit">
                  <Button className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0">
                    Submit First Post
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Feed */}
        {!isLoading && !isEmpty && (
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {safePosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={
                    newPostIds.has(post.id)
                      ? { opacity: 0, y: -20, scale: 0.95 }
                      : { opacity: 0, y: 20 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.4,
                    delay: isLoading ? 0 : index * 0.05,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className={`relative ${
                    newPostIds.has(post.id) ? "new-post-glow" : ""
                  }`}
                >
                  {newPostIds.has(post.id) && (
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-75 animate-pulse" />
                  )}
                  <div className="relative">
                    <FeedCardWithImage post={post} priority={index < 3} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Load more trigger */}
            <div ref={ref} className="py-8">
              {isLoadingMore && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-20 animate-pulse" />
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 relative z-10" />
                  </div>
                </motion.div>
              )}
              {isReachingEnd && posts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/50 border border-gray-800">
                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                    <p className="text-gray-500 text-sm font-medium">
                      You've reached the end
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FeedCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl neumorph-glass p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/5 via-transparent to-gray-900/5" />
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <Skeleton className="h-6 w-32 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
          <Skeleton className="h-6 w-24 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
        </div>
        <Skeleton className="h-4 w-full mb-2 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
        <Skeleton className="h-4 w-3/4 mb-4 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
            <Skeleton className="h-4 w-24 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
          </div>
          <Skeleton className="h-4 w-16 bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer" />
        </div>
      </div>
    </div>
  );
}
