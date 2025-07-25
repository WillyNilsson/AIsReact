import { useEffect, useRef } from "react";
import { useVoteStore } from "@/store/voteStore";
import { useAuth } from "@/hooks/useAuth";

interface PostWithOptionalVote {
  id: number;
  user_vote?: boolean | null;
}

// Hook to sync vote indicators with API data and local store
export function useVoteSync(posts: PostWithOptionalVote[] | undefined) {
  const { user } = useAuth();
  const { syncVotesFromApi, clearVotes } = useVoteStore();
  const lastSyncedRef = useRef<string>("");
  const wasAuthenticatedRef = useRef<boolean>(false);

  useEffect(() => {
    const isAuthenticated = !!user;

    // Clear votes if user logged out
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      clearVotes();
      lastSyncedRef.current = "";
    }

    wasAuthenticatedRef.current = isAuthenticated;

    // Only sync if authenticated and we have posts
    if (!isAuthenticated || !posts || posts.length === 0) {
      return;
    }

    // Create a stable key from the vote data to detect actual changes
    const votesFromApi = posts
      .filter(
        (post) =>
          "user_vote" in post &&
          post.user_vote !== null &&
          post.user_vote !== undefined,
      )
      .map((post) => ({
        postId: post.id,
        vote: post.user_vote as boolean,
      }));

    // Create a key that represents the current vote state
    const syncKey = votesFromApi
      .map((v) => `${v.postId}:${v.vote}`)
      .sort()
      .join(",");

    // Only sync if the vote data has actually changed
    if (syncKey !== lastSyncedRef.current && votesFromApi.length > 0) {
      syncVotesFromApi(votesFromApi);
      lastSyncedRef.current = syncKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, user]); // Zustand actions are stable and don't need to be in deps
}

// Hook to get vote status with fallback to local store
export function usePostVoteStatus(
  postId: number,
  apiVote?: boolean | null,
): boolean | null {
  const localVote = useVoteStore((state) => state.getVote(postId));

  // API vote takes precedence over local store
  if (apiVote !== null && apiVote !== undefined) {
    return apiVote;
  }

  return localVote;
}
