"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationErrorBoundary } from "@/components/error-boundary/navigation-error-boundary";
// import { OptimizedImage } from '@/components/ui/optimized-image';
import { usePost } from "@/hooks/usePost";
import { useAuthStore } from "@/store/authStore";
import { PostStatus } from "@/lib/types";
import { useVerificationStats } from "@/hooks/useVerification";
// TEMPORARILY DISABLED: Community voting
// import { useOptimisticVote } from "@/lib/hooks/useOptimisticVote";
import { AIResponsesView } from "@/components/ai/ai-responses-view";
import { Bell, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { safeLocaleString } from "@/lib/utils/date";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { VoteButtons } from "@/components/ui/vote-buttons";
import { AdminApproveButton } from "@/components/ui/admin-approve-button";
import { DangerZoneDelete, DeleteButton } from "@/components/ui/delete-button";

function PostDetailContent() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Extract ID safely
  let rawId: string | string[] | undefined;
  if (params && typeof params === "object" && "id" in params) {
    rawId = params.id;
  }

  const postId = rawId ? Number(Array.isArray(rawId) ? rawId[0] : rawId) : null;
  const user = useAuthStore((state) => state.user);
  const [hasNewUpdate, _setHasNewUpdate] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { addToast } = useToast();

  // Guard against invalid postId
  const validPostId = postId && !isNaN(postId) ? postId : null;

  // Get post data
  const { data: post, isLoading, error } = usePost(validPostId);
  const { data: stats } = useVerificationStats(validPostId);
  // TEMPORARILY DISABLED: Community voting
  // const { vote, isVoting } = useOptimisticVote();

  // Check if we should show polling status
  const shouldPoll =
    post?.status === "live" &&
    (!post?.ai_responses || post.ai_responses.length < 5);

  // Update last updated timestamp when data changes
  useEffect(() => {
    if (post) {
      setLastUpdated(new Date());
    }
  }, [post]);

  const handleDelete = async () => {
    if (!post) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/posts/${post.id}/`);

      // Invalidate all relevant queries to clear any cached data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["verification", "queue"] }),
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["post", post.id] }),
      ]);

      addToast({
        type: "success",
        title: "Post deleted successfully",
      });

      // Small delay to ensure queries are invalidated before navigation
      setTimeout(() => {
        router.push("/");
      }, 100);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete post";
      addToast({
        type: "error",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Real-time updates removed - using manual refresh instead
  // Polling is now used for AI analysis updates when shouldPoll is true

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!validPostId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error">
          <p>Invalid post ID</p>
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Back to Home
        </Button>
      </div>
    );
  }

  if (error || !post) {
    // Added !post check
    const is404 = false; // React Query errors don't have status property
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error">
          <p>
            {is404
              ? "Post not found"
              : "Failed to load post. Please try again later."}
          </p>
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Back to Home
        </Button>
      </div>
    );
  }

  if (!post && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error">
          <p>Post not found</p>
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Back to Home
        </Button>
      </div>
    );
  }

  // Show loading state while data is being fetched
  if (isLoading || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-6">
            <div className="h-4 bg-gray-300 rounded w-24 mb-8"></div>
          </div>
          <Card className="p-6 mb-6">
            <div className="h-8 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/3"></div>
          </Card>
          <Card className="p-6 mb-6">
            <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Final safety check - this should never happen due to the loading check above,
  // but it's a failsafe against race conditions
  if (!post) {
    return null;
  }

  const isOwner = user?.id && post?.user?.id && user.id === post.user.id;
  // Don't allow deletion of analyzed posts (LIVE status) to preserve historical data
  const canDelete =
    (isOwner || user?.role === "admin") && post.status !== PostStatus.LIVE;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/">
          <Button variant="outline" size="sm">
            ← Back to Home
          </Button>
        </Link>

        <div className="flex items-center gap-4">
          {shouldPoll && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Last updated: {format(lastUpdated, "HH:mm:ss")}</span>
            </div>
          )}

          {hasNewUpdate && (
            <div className="flex items-center gap-2 text-sm text-accent-400 animate-pulse">
              <Bell className="w-4 h-4" />
              <span>New updates available</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Post Card - Combined */}
      <div className="bg-gradient-to-br from-[#1a1b26]/90 to-[#2a2d3a]/90 rounded-2xl p-8 mb-8 backdrop-blur-sm border border-[#2a2d3a]">
        {/* Header with title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3 text-[#c0caf5]">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-[#9aa5ce]">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>{post?.user?.username || "Unknown"}</span>
            </div>
            <span className="text-[#565a6e]">•</span>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{safeLocaleString(post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Source URL */}
        <div className="mb-6">
          <a
            href={post.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#7aa2f7] hover:text-[#89b4fa] transition-colors"
          >
            {/* Favicon */}
            {(() => {
              try {
                const hostname = new URL(post.source_url).hostname;
                return (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      // On error, show the external link icon
                      const svg = document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "svg",
                      );
                      svg.setAttribute("class", "w-4 h-4");
                      svg.setAttribute("fill", "none");
                      svg.setAttribute("stroke", "currentColor");
                      svg.setAttribute("viewBox", "0 0 24 24");
                      svg.innerHTML =
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />';
                      e.currentTarget.parentNode?.replaceChild(
                        svg,
                        e.currentTarget,
                      );
                    }}
                  />
                );
              } catch {
                return (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                );
              }
            })()}
            <span className="underline decoration-dotted underline-offset-2">
              {(() => {
                try {
                  const url = new URL(post.source_url);
                  return url.hostname.replace("www.", "");
                } catch {
                  return post.source_url;
                }
              })()}
            </span>
          </a>
        </div>

        {/* Image - TEMPORARILY DISABLED FOR COPYRIGHT REASONS */}
        {/* {post.image_url && (
          <div className="relative w-full mb-6 rounded-xl overflow-hidden">
            <img
              src={post.image_url}
              alt="Post content"
              className="w-full h-auto"
            />
          </div>
        )} */}

        {/* Rejection Reason */}
        {post.status === PostStatus.REJECTED && post.rejection_reason && (
          <Alert variant="error" className="mb-6">
            <p className="font-semibold">Rejection Reason:</p>
            <p>{post.rejection_reason}</p>
          </Alert>
        )}

        {/* Notice to visit source - only show for posts pending verification */}
        {post.status === PostStatus.PENDING_VERIFICATION && (
          <div className="mb-8">
            <Alert className="bg-blue-500/10 border-blue-500/30">
              <AlertDescription>
                Please visit the source article to read the full content and
                verify the information before voting.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Voting section for pending verification posts */}
        {post.status === PostStatus.PENDING_VERIFICATION && user && (
          <div className="border-t border-[#2a2d3a] pt-6">
            <p className="text-sm text-[#787c99] mb-3">
              This post is pending community verification. Help verify its
              accuracy!
            </p>
            {/* TEMPORARILY DISABLED: Community voting disabled due to copyright changes */}
            <div className="relative">
              <div className="opacity-50 pointer-events-none">
                <VoteButtons
                  postId={post.id}
                  userVote={stats?.user_vote}
                  isVoting={false}
                  onVote={async () => {
                    // Voting disabled
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-amber-400 bg-[#1a1b26]/90 px-3 py-1.5 rounded-lg border border-amber-500/30">
                  Voting temporarily disabled
                </span>
              </div>
            </div>
            {user?.role === "admin" && (
              <div className="mt-4">
                <AdminApproveButton postId={post.id} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Delete Action */}
        {canDelete && (
          <DangerZoneDelete
            onDelete={() => setShowDeleteDialog(true)}
            buttonText="Delete Post"
            className="border-t border-[#2a2d3a] pt-6 mt-6"
          />
        )}
      </div>

      {/* AI Responses */}
      <Card className="p-6 mb-6">
        <AIResponsesView responses={post.ai_responses || []} postId={post.id} />
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <DeleteButton
              onClick={handleDelete}
              disabled={isDeleting}
              size="md"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </DeleteButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <NavigationErrorBoundary>
      <PostDetailContent />
    </NavigationErrorBoundary>
  );
}
