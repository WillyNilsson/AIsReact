import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
  PostFeedItem,
  VerificationVoteCreate,
  VerificationStats,
} from "../types";
import { useVoteStore } from "@/store/voteStore";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors/messages";

interface OptimisticVoteOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

interface VoteRollback {
  postId: number;
  previousVote: boolean | null;
  previousScore: number;
  timestamp: number;
}

// Cast a verification vote
async function castVote({
  postId,
  voteData,
}: {
  postId: number;
  voteData: VerificationVoteCreate;
}) {
  try {
    const response = await api.post(
      `/api/posts/${postId}/verify/`,
      voteData as unknown as Record<string, unknown>,
    );
    return response;
  } catch (error) {
    // Log detailed error info for debugging
    // eslint-disable-next-line no-console
    console.error("Vote submission error:", {
      postId,
      voteData,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorResponse: (error as unknown as { response?: { data?: unknown } })
        ?.response?.data,
      errorStatus: (error as unknown as { response?: { status?: number } })
        ?.response?.status,
    });
    throw error;
  }
}

export function useOptimisticVote(options?: OptimisticVoteOptions) {
  const queryClient = useQueryClient();
  const { setVote, getVote } = useVoteStore();
  const { addToast } = useToast();
  const rollbackRef = useRef<VoteRollback | null>(null);

  const mutation = useMutation({
    mutationFn: castVote,
    onMutate: async ({ postId, voteData }) => {
      try {
        // Store current state for potential rollback
        const previousVote = getVote(postId);
        const currentPost = queryClient.getQueryData<PostFeedItem>([
          "post",
          postId,
        ]);
        const previousScore = currentPost?.verification_score || 0;

        rollbackRef.current = {
          postId,
          previousVote,
          previousScore,
          timestamp: Date.now(),
        };

        // Check if toggling off (removing vote)
        const isRemovingVote = previousVote === voteData.vote;

        // Optimistically update local state
        if (isRemovingVote) {
          setVote(postId, null);
        } else {
          setVote(postId, voteData.vote);
        }

        // Cancel any outgoing refetches
        try {
          await queryClient.cancelQueries({ queryKey: ["post", postId] });
          await queryClient.cancelQueries({ queryKey: ["feed"] });
          await queryClient.cancelQueries({
            queryKey: ["verification", postId],
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error cancelling queries:", error);
        }

        // Optimistically update the post data
        queryClient.setQueryData<PostFeedItem>(["post", postId], (old) => {
          if (!old) {
            return old;
          }
          let scoreChange = 0;
          if (isRemovingVote) {
            // Removing vote
            scoreChange = voteData.vote ? -1 : 1;
          } else if (previousVote !== null) {
            // Changing vote
            scoreChange = voteData.vote ? 2 : -2;
          } else {
            // New vote
            scoreChange = voteData.vote ? 1 : -1;
          }

          return {
            ...old,
            user_vote: isRemovingVote ? null : voteData.vote,
            verification_score: previousScore + scoreChange,
          };
        });

        // Update post in feed caches
        queryClient.setQueriesData<{
          pages: Array<{ results: PostFeedItem[] }>;
        }>({ queryKey: ["feed"] }, (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map((post) => {
                if (post.id === postId) {
                  let scoreChange = 0;
                  if (isRemovingVote) {
                    scoreChange = voteData.vote ? -1 : 1;
                  } else if (previousVote !== null) {
                    scoreChange = voteData.vote ? 2 : -2;
                  } else {
                    scoreChange = voteData.vote ? 1 : -1;
                  }

                  return {
                    ...post,
                    user_vote: isRemovingVote ? null : voteData.vote,
                    verification_score: post.verification_score + scoreChange,
                  };
                }
                return post;
              }),
            })),
          };
        });

        // Update verification queue (for infinite query)
        queryClient.setQueriesData<{
          pages: Array<{ results: PostFeedItem[] }>;
        }>({ queryKey: ["verification", "queue", "infinite"] }, (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map((post) => {
                if (post.id === postId) {
                  return {
                    ...post,
                    user_vote: isRemovingVote ? null : voteData.vote,
                  };
                }
                return post;
              }),
            })),
          };
        });

        // Update verification stats
        queryClient.setQueryData<VerificationStats>(
          ["verification", postId, "stats"],
          (old) => {
            if (!old) {
              return old;
            }

            if (isRemovingVote) {
              return {
                ...old,
                user_vote: null,
                total_votes: Math.max(0, old.total_votes - 1),
                positive_votes: voteData.vote
                  ? Math.max(0, old.positive_votes - 1)
                  : old.positive_votes,
                negative_votes: !voteData.vote
                  ? Math.max(0, old.negative_votes - 1)
                  : old.negative_votes,
              };
            } else if (previousVote !== null) {
              // Changing vote
              return {
                ...old,
                user_vote: voteData.vote ? "positive" : "negative",
                positive_votes: voteData.vote
                  ? old.positive_votes + 1
                  : Math.max(0, old.positive_votes - 1),
                negative_votes: !voteData.vote
                  ? old.negative_votes + 1
                  : Math.max(0, old.negative_votes - 1),
              };
            } else {
              // New vote
              return {
                ...old,
                user_vote: voteData.vote ? "positive" : "negative",
                total_votes: old.total_votes + 1,
                positive_votes: old.positive_votes + (voteData.vote ? 1 : 0),
                negative_votes: old.negative_votes + (!voteData.vote ? 1 : 0),
              };
            }
          },
        );

        return { previousVote, previousScore };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error in onMutate:", error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Show success feedback
      const postId = variables.postId;

      // Determine the actual vote state from the response
      // The backend might return different formats, so we need to check multiple fields
      let newUserVote: boolean | null = null;

      // The backend returns the vote data in the response
      // According to the Django backend analysis, it returns:
      // - vote: boolean (true/false)
      // - vote_type: "positive" | "negative"
      // When toggling off the same vote, the backend still returns the vote
      // but the UI should show no vote selected

      // First check if this was a toggle-off scenario
      const previousVote = rollbackRef.current?.previousVote;
      const submittedVote = variables.voteData.vote;
      const wasToggleOff = previousVote === submittedVote;

      if (wasToggleOff) {
        // User clicked the same vote again, so it should be removed
        newUserVote = null;
      } else if (data) {
        // Extract vote from response
        if (typeof data.vote === "boolean") {
          newUserVote = data.vote;
        } else if (data.vote_type === "positive") {
          newUserVote = true;
        } else if (data.vote_type === "negative") {
          newUserVote = false;
        }
      }

      // Determine if this was a removal based on the final vote state
      const isRemoval = newUserVote === null;

      // Vote state has been determined

      // Update the local vote store with the correct value
      setVote(postId, newUserVote);

      // Update cached data with the correct vote value before invalidation
      queryClient.setQueryData<PostFeedItem>(["post", postId], (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          user_vote: newUserVote,
          verification_score:
            data?.new_verification_score ?? old.verification_score,
          verification_count:
            data?.new_verification_count ?? old.verification_count,
        };
      });

      // Update feed caches with the correct vote value
      queryClient.setQueriesData<{
        pages: Array<{ results: PostFeedItem[] }>;
      }>({ queryKey: ["feed"] }, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: page.results.map((post) => {
              if (post.id === postId) {
                return {
                  ...post,
                  user_vote: newUserVote,
                  verification_score:
                    data?.new_verification_score ?? post.verification_score,
                  verification_count:
                    data?.new_verification_count ?? post.verification_count,
                };
              }
              return post;
            }),
          })),
        };
      });

      // Update verification queue with the correct vote value
      queryClient.setQueriesData<{
        pages: Array<{ results: PostFeedItem[] }>;
      }>({ queryKey: ["verification", "queue", "infinite"] }, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            results: page.results.map((post) => {
              if (post.id === postId) {
                return {
                  ...post,
                  user_vote: newUserVote,
                };
              }
              return post;
            }),
          })),
        };
      });

      addToast({
        type: "success",
        title: isRemoval ? "Vote removed" : "Vote submitted",
        description: isRemoval
          ? "Your vote has been removed"
          : rollbackRef.current?.previousVote !== null &&
              rollbackRef.current?.previousVote !== undefined
            ? "Vote updated!"
            : "Thanks for voting!",
      });

      // Call success callback
      options?.onSuccess?.();

      // Clear rollback data on success
      rollbackRef.current = null;

      // Invalidate queries to ensure consistency
      // Note: We update the cache first, then invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({
        queryKey: ["verification", "stats", postId],
      });
      queryClient.invalidateQueries({ queryKey: ["verification", "queue"] });
      queryClient.invalidateQueries({
        queryKey: ["verification", "queue", "infinite"],
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error, { postId }, context) => {
      // Rollback optimistic updates on failure
      if (
        context?.previousVote !== undefined &&
        context.previousVote !== null
      ) {
        setVote(postId, context.previousVote);
      } else {
        // Remove vote from store if it didn't exist before
        const state = useVoteStore.getState();
        if (state && state.votes) {
          state.votes.delete(postId);
        }
      }

      // Rollback query data
      queryClient.setQueryData<PostFeedItem>(["post", postId], (old) => {
        if (!old || !context) {
          return old;
        }
        return {
          ...old,
          user_vote: context.previousVote,
          verification_score: context.previousScore,
        };
      });

      // Rollback feed data
      queryClient.setQueriesData<{ pages: Array<{ results: PostFeedItem[] }> }>(
        { queryKey: ["feed"] },
        (old) => {
          if (!old || !context) {
            return old;
          }
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      user_vote: context.previousVote,
                      verification_score: context.previousScore,
                    }
                  : post,
              ),
            })),
          };
        },
      );

      // Show error feedback
      const errorMsg = getErrorMessage(error, { action: "verify" });
      addToast({
        type: "error",
        title: "Vote submission failed",
        description: errorMsg,
      });

      // Call error callback
      options?.onError?.(error);
    },
  });

  const vote = useCallback(
    async ({
      postId,
      voteData,
    }: {
      postId: number;
      voteData: VerificationVoteCreate;
      currentPost?: PostFeedItem;
      currentStats?: VerificationStats;
    }) => {
      return mutation.mutateAsync({ postId, voteData });
    },
    [mutation],
  );

  return {
    vote,
    isVoting: mutation.isPending,
    error: mutation.error,
  };
}

// Helper to handle race conditions by debouncing rapid votes
export function useDebouncedVote(delay: number = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { vote, isVoting, error } = useOptimisticVote();

  const debouncedVote = useCallback(
    async (params: Parameters<typeof vote>[0]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      return new Promise<void>((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            await vote(params);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    },
    [vote, delay],
  );

  return {
    vote: debouncedVote,
    isVoting,
    error,
  };
}
