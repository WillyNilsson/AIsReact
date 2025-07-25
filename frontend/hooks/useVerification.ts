import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { z } from "zod";
import { PostFeedItemSchema } from "@/lib/schemas/post";
import { useAuthStore } from "@/store/authStore";
import { logger } from "@/lib/logger";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Verification schemas
const VerificationStatsSchema = z.object({
  post_id: z.number(),
  total_votes: z.number(),
  positive_votes: z.number(),
  negative_votes: z.number(),
  verification_score: z.number(),
  user_vote: z.enum(["positive", "negative"]).nullable(),
});

const VerificationVoteSchema = z.object({
  id: z.number(),
  user: z.object({
    id: z.number(),
    username: z.string(),
  }),
  post_id: z.number(),
  vote_type: z.enum(["positive", "negative"]),
  reason: z.string().optional(),
  created_at: z.string(),
});

const VerificationQueueResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(PostFeedItemSchema),
});

export type VerificationStats = z.infer<typeof VerificationStatsSchema>;
export type VerificationVote = z.infer<typeof VerificationVoteSchema>;
export type VerificationQueueResponse = z.infer<
  typeof VerificationQueueResponseSchema
>;

// Get verification queue
export function useVerificationQueue(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["verification", "queue", { page, limit }],
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/feed/pending/?page=${page}&page_size=${limit}`,
        { headers },
      );

      if (!response.ok) {
        logger.error(
          `Failed to fetch verification queue: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to fetch verification queue: ${response.statusText}`,
        );
      }

      const data = await response.json();
      // Verification queue raw response

      try {
        // Check if the response is in the expected format
        if (!data || typeof data !== "object") {
          throw new Error("Invalid response format");
        }

        // Handle empty response or missing pagination fields
        if (Object.keys(data).length === 0 || (!data.results && !data.count)) {
          // No posts pending verification
          return [];
        }

        // If the backend returns results directly (array), wrap it
        if (Array.isArray(data)) {
          const wrappedData = {
            count: data.length,
            next: null,
            previous: null,
            results: data,
          };
          const validated = VerificationQueueResponseSchema.parse(wrappedData);
          return validated.results;
        }

        // Handle paginated response with default values for missing fields
        const paginatedData = {
          count: data.count ?? 0,
          next: data.next ?? null,
          previous: data.previous ?? null,
          results: data.results ?? [],
        };

        // Validate with the fixed data
        const validated = VerificationQueueResponseSchema.parse(paginatedData);
        return validated.results;
      } catch (error) {
        logger.error("Verification queue validation error", error, {
          receivedData: data,
          validationErrors:
            error instanceof z.ZodError ? error.errors : undefined,
        });

        // If validation fails but we have results, return them anyway
        if (data?.results && Array.isArray(data.results)) {
          logger.warn("Returning unvalidated results");
          return data.results;
        }

        // Return empty array instead of throwing for better UX
        logger.warn(
          "Unable to parse verification queue data, returning empty array",
        );
        return [];
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 2, // Retry twice on failure
  });
}

// Get verification queue with infinite scroll
export function useVerificationQueueInfinite(limit: number = 10) {
  return useInfiniteQuery({
    queryKey: ["verification", "queue", "infinite", { limit }],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/feed/pending/?page=${pageParam}&page_size=${limit}`,
        {
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch verification queue: ${response.status}`,
        );
      }

      const data = await response.json();

      // Handle the response similar to the regular queue
      try {
        const paginatedData = {
          count: data.count ?? 0,
          next: data.next ?? null,
          previous: data.previous ?? null,
          results: data.results ?? [],
        };

        const validated = VerificationQueueResponseSchema.parse(paginatedData);
        return validated;
      } catch (error) {
        logger.error("Verification queue validation error", error);

        // Return a default structure if validation fails
        return {
          count: data.count || 0,
          next: data.next || null,
          previous: data.previous || null,
          results: data.results || [],
        };
      }
    },
    getNextPageParam: (lastPage, _pages) => {
      if (!lastPage.next) {
        return undefined;
      }
      // Extract page number from next URL
      const url = new URL(lastPage.next);
      const page = url.searchParams.get("page");
      return page ? parseInt(page, 10) : undefined;
    },
    staleTime: 30 * 1000,
    retry: 2,
  });
}

// Get verification stats for a post
export function useVerificationStats(postId: number | null) {
  return useQuery({
    queryKey: ["verification", "stats", postId],
    queryFn: async () => {
      if (!postId) {
        throw new Error("No post ID provided");
      }

      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Use the verification-stats endpoint
      const response = await fetch(
        `${API_URL}/api/posts/${postId}/verification-stats/`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch verification stats: ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Validate the response
      try {
        return VerificationStatsSchema.parse(data);
      } catch (error) {
        logger.error("Invalid verification stats data", error);
        throw new Error("Received invalid verification stats from server");
      }
    },
    enabled: !!postId,
  });
}

// Cast a verification vote
export function useVerificationVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      voteData,
    }: {
      postId: number;
      voteData: { vote_type: "positive" | "negative"; reason?: string };
    }) => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/posts/${postId}/verify/`, {
        method: "POST",
        headers,
        body: JSON.stringify(voteData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to submit vote");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["post", variables.postId] });
      queryClient.invalidateQueries({
        queryKey: ["verification", "stats", variables.postId],
      });
      queryClient.invalidateQueries({ queryKey: ["verification", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

// Delete a verification vote - NOT IMPLEMENTED IN BACKEND
// Commenting out until backend implements DELETE /api/posts/{id}/verify/
/*
export function useDeleteVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/posts/${postId}/verify/`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete vote');
      }

      return response.json();
    },
    onSuccess: (_, postId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['verification', 'stats', postId] });
      queryClient.invalidateQueries({ queryKey: ['verification', 'queue'] });
    },
  });
}
*/
