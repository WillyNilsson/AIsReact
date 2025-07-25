"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { InfiniteScrollList } from "@/components/ui/infinite-scroll-list";
import {
  useVerificationQueueInfinite,
  type VerificationQueueResponse,
} from "@/hooks/useVerification";
import { useOptimisticVote } from "@/lib/hooks/useOptimisticVote";
// TEMPORARILY DISABLED FOR V1: Email verification
// import EmailVerificationGuard from '@/components/auth/email-verification-guard';
import { useVoteSync } from "@/lib/hooks/useVoteSync";
import { PostFeedItem } from "@/lib/types";
import { VerificationPostCard } from "./VerificationPostCard";

export default function VerifyPage() {
  const router = useRouter();
  const [votingPostId, setVotingPostId] = useState<number | null>(null);

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useVerificationQueueInfinite(10); // 10 items per page

  const { vote, isVoting } = useOptimisticVote();

  // Flatten all pages into a single array of posts
  const posts = useMemo(() => {
    if (!data?.pages) {
      return [];
    }
    return (data.pages as VerificationQueueResponse[]).flatMap(
      (page) => page.results,
    );
  }, [data]);

  // Sync vote data from API
  useVoteSync(posts);

  const handleVote = async (
    postId: number,
    voteValue: boolean,
    post: PostFeedItem,
  ) => {
    setVotingPostId(postId);
    try {
      await vote({
        postId,
        voteData: {
          vote: voteValue,
        },
        currentPost: post,
      });
      setVotingPostId(null);
    } catch {
      setVotingPostId(null);
    }
  };

  const emptyState = (
    <Card className="p-8 text-center bg-[#1a1b26] border-[#2a2d3a]">
      <h3 className="text-lg font-semibold mb-2 text-[#c0caf5]">
        No posts to verify
      </h3>
      <p className="text-[#9aa5ce] mb-4">
        There are currently no posts pending verification. Posts need to pass
        moderation before they appear here.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => router.push("/")} variant="outline">
          Back to Home
        </Button>
        <Button onClick={() => router.push("/submit")} variant="primary">
          Submit a Post
        </Button>
      </div>
    </Card>
  );

  return (
    // TEMPORARILY DISABLED FOR V1: EmailVerificationGuard wrapper
    // <EmailVerificationGuard>
    <>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verify Posts</h1>
          <p className="text-gray-600">
            Help maintain content quality by verifying the accuracy of submitted
            posts.
          </p>
        </div>

        {error && !posts.length && (
          <Alert variant="error" className="mb-6">
            {error.message ||
              "Failed to load verification queue. Please try again later."}
          </Alert>
        )}

        <InfiniteScrollList
          items={posts}
          renderItem={(post: PostFeedItem) => (
            <VerificationPostCard
              key={post.id}
              post={post}
              onVote={handleVote}
              isVoting={isVoting}
              votingPostId={votingPostId}
            />
          )}
          onLoadMore={() => fetchNextPage()}
          isLoading={isLoading}
          isLoadingMore={isFetchingNextPage}
          hasMore={hasNextPage ?? false}
          emptyState={emptyState}
        />
      </div>
      {/* </EmailVerificationGuard> */}
    </>
  );
}
