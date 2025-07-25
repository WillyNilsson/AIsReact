"use client";

import { useRouter } from "next/navigation";
import { PostFeedItem, PostStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import {
  Clock,
  User,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Brain,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils/date";
import { usePostVoteStatus } from "@/lib/hooks/useVoteSync";
import { cn } from "@/lib/utils";

interface FeedCardWithImageProps {
  post: PostFeedItem;
  priority?: boolean;
}

export function FeedCardWithImage({
  post,
  priority: _priority = false,
}: FeedCardWithImageProps) {
  const router = useRouter();
  const userVote = usePostVoteStatus(post.id, post.user_vote);

  const _statusConfig: Record<
    PostStatus,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    [PostStatus.PENDING_MODERATION]: {
      bg: "bg-yellow-500/10 border-yellow-500/20",
      text: "text-yellow-400",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    [PostStatus.PENDING_VERIFICATION]: {
      bg: "bg-blue-500/10 border-blue-500/20",
      text: "text-blue-400",
      icon: <Clock className="w-3 h-3" />,
    },
    [PostStatus.REJECTED]: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: <XCircle className="w-3 h-3" />,
    },
    [PostStatus.LIVE]: {
      bg: "bg-green-500/10 border-green-500/20",
      text: "text-green-400",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    [PostStatus.DISPUTED]: {
      bg: "bg-orange-500/10 border-orange-500/20",
      text: "text-orange-400",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    [PostStatus.REMOVED]: {
      bg: "bg-gray-500/10 border-gray-500/20",
      text: "text-gray-400",
      icon: <XCircle className="w-3 h-3" />,
    },
  };

  return (
    <motion.div whileHover={{ scale: 1.002 }} transition={{ duration: 0.2 }}>
      <Card
        className={cn(
          "group relative overflow-hidden bg-[#1a1b26] border-[#2a2d3a] hover:border-[#3a3f4f] transition-all duration-300 cursor-pointer hover:shadow-xl",
          userVote !== null &&
            "border-blue-500/40 shadow-blue-500/10 shadow-md",
        )}
        onClick={() => router.push(`/posts/${post.id}`)}
      >
        <div className="relative p-5">
          {/* Header with title and status */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-[#c0caf5] line-clamp-2 group-hover:text-[#7dcfff] transition-colors flex-1">
                {post.title}
              </h3>
            </div>

            {/* Source URL */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(post.source_url, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#7aa2f7] hover:text-[#89b4fa] transition-colors mb-3 cursor-pointer bg-transparent border-none p-0"
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
            </button>
          </div>

          {/* Image if present - TEMPORARILY DISABLED FOR COPYRIGHT REASONS */}
          {/* {post.image_url && (
            <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-[#1e1f2e]">
              <img
                src={post.image_url}
                alt="Post image"
                className="w-full h-full object-cover"
                loading={priority ? "eager" : "lazy"}
              />
            </div>
          )} */}

          {/* AI Summary for live posts */}
          {post.status === PostStatus.LIVE && post.ai_summary && (
            <div className="mb-4">
              <p className="text-xs text-[#565a6e] mb-1 uppercase tracking-wider">
                AI Summary
              </p>
              <p className="text-sm text-[#9aa5ce] line-clamp-2">
                {(() => {
                  const sentences = post.ai_summary.split(". ");
                  if (sentences.length === 0) {
                    return post.ai_summary;
                  }

                  // Take first two sentences
                  const firstTwo = sentences.slice(0, 4).join(". ");
                  // Add period if it doesn't end with one
                  return firstTwo.endsWith(".") ? firstTwo : `${firstTwo}.`;
                })()}
              </p>
            </div>
          )}

          {/* Footer with metadata */}
          <div className="flex items-center justify-between pt-3 border-t border-[#2a2d3a]">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-[#787c99]">
                <User className="w-3.5 h-3.5" />
                <span>{post.user?.username || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#787c99]">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDate(post.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(post.ai_response_count ?? 0) > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#7aa2f7]/10 border border-[#7aa2f7]/20">
                  <Brain className="w-3 h-3 text-[#7aa2f7]" />
                  <span className="text-[#7aa2f7] text-xs font-medium">
                    {post.ai_response_count}
                  </span>
                </div>
              )}
              {post.verification_score > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs font-medium">
                    {post.verification_score}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
