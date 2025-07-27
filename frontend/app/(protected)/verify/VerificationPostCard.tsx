"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoteButtons } from "@/components/ui/vote-buttons";
import { AdminApproveButton } from "@/components/ui/admin-approve-button";
// TEMPORARILY DISABLED: Not needed without community voting
// import { useVerificationStats } from "@/hooks/useVerification";
import { PostFeedItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Clock, User, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useVoteStore } from "@/store/voteStore";

interface VerificationPostCardProps {
  post: PostFeedItem;
  // TEMPORARILY DISABLED: These props kept for easy re-enabling when community voting returns
  onVote: (postId: number, voteValue: boolean, post: PostFeedItem) => void;
  isVoting: boolean;
  votingPostId: number | null;
}

export function VerificationPostCard({
  post,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onVote,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isVoting,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  votingPostId,
}: VerificationPostCardProps) {
  // TEMPORARILY DISABLED: Verification stats no longer needed without community voting
  // const { data: stats } = useVerificationStats(post.id);
  const user = useAuthStore((state) => state.user);
  const getVote = useVoteStore((state) => state.getVote);

  // Get the current vote from the vote store, falling back to post data or stats
  const currentVote = getVote(post.id);
  const userVoteBoolean =
    currentVote !== undefined ? currentVote : post.user_vote;

  // Convert boolean to string format expected by VoteButtons
  const userVote =
    userVoteBoolean === true
      ? "positive"
      : userVoteBoolean === false
        ? "negative"
        : null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-[#1a1b26] border-[#2a2d3a] p-5 transition-all duration-300",
        userVoteBoolean === true &&
          "border-green-500/40 bg-green-500/5 shadow-green-500/10 shadow-md",
        userVoteBoolean === false &&
          "border-red-500/40 bg-red-500/5 shadow-red-500/10 shadow-md",
      )}
    >
      {/* Header with title */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#c0caf5] line-clamp-2 mb-2">
          {post.title}
        </h3>

        {/* Source URL */}
        <a
          href={post.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#7aa2f7] hover:text-[#89b4fa] transition-colors mb-3"
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
                    e.currentTarget.style.display = "none";
                  }}
                />
              );
            } catch {
              return <ExternalLink className="w-3 h-3" />;
            }
          })()}
          <span className="underline decoration-dotted underline-offset-2">
            {(() => {
              try {
                const url = new URL(post.source_url);
                return url.hostname.replace("www.", "");
              } catch {
                return "View source";
              }
            })()}
          </span>
        </a>
      </div>

      {/* Image if present - TEMPORARILY DISABLED FOR COPYRIGHT REASONS */}
      {/* {post.image_url && (
        <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-[#1e1f2e]">
          <img
            src={post.image_url}
            alt="Post image"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )} */}

      {/* Metadata */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#2a2d3a]">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#787c99]">
            <User className="w-3.5 h-3.5" />
            <span>{post.user?.username || "Unknown"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#787c99]">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Pending Verification
          </span>
          {post.verification_score !== 0 && (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Score: {post.verification_score}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <div className="flex-1">
          {/* TEMPORARILY DISABLED: Community voting disabled due to copyright changes */}
          <div className="relative">
            <div className="opacity-50 pointer-events-none">
              <VoteButtons
                postId={post.id}
                userVote={userVote}
                isVoting={false}
                onVote={async () => {
                  // Voting disabled
                }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-amber-400 bg-[#1a1b26]/80 px-2 py-1 rounded">
                Voting temporarily disabled
              </span>
            </div>
          </div>
        </div>
        <Link href={`/posts/${post.id}`}>
          <Button
            variant="ghost"
            className="text-[#787c99] hover:text-[#c0caf5] h-10"
          >
            View Full
          </Button>
        </Link>
      </div>

      {/* Admin approve button */}
      {user?.role === "admin" && (
        <div className="mt-3">
          <AdminApproveButton postId={post.id} className="w-full" />
        </div>
      )}
    </Card>
  );
}
