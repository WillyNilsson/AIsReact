import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { z } from "zod";
import { PostSchema } from "@/lib/schemas/post";
import { useAuthStore } from "@/store/authStore";
import { parseErrorResponse } from "@/lib/schemas/error";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Moderation schemas
const ModerationStatsSchema = z.object({
  total_pending: z.number(),
  reviewed_today: z.number(),
  approved_today: z.number(),
  rejected_today: z.number(),
  average_review_time: z.number(),
  pending_by_category: z.record(z.number()),
});

const ModerationQueueResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(PostSchema),
});

const ModerationHistoryItemSchema = z.object({
  id: z.number(),
  post: PostSchema,
  moderator: z.object({
    id: z.number(),
    username: z.string(),
  }),
  action: z.enum(["approved", "rejected"]),
  reason: z.string().optional(),
  moderated_at: z.string(),
});

export type ModerationStats = z.infer<typeof ModerationStatsSchema>;
export type ModerationHistoryItem = z.infer<typeof ModerationHistoryItemSchema>;

// Get moderation stats
export function useModerationStats() {
  const token = useAuthStore.getState().accessToken;

  return useQuery({
    queryKey: ["moderation", "stats"],
    queryFn: async () => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/moderation/stats/`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch moderation stats: ${response.statusText}`,
        );
      }

      const data = await response.json();

      try {
        return ModerationStatsSchema.parse(data);
      } catch (error) {
        throw new Error("Received invalid moderation stats from server");
      }
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Get moderation queue
export function useModerationQueue(
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
  const token = useAuthStore.getState().accessToken;

  return useQuery({
    queryKey: ["moderation", "queue", { page, limit, search }],
    queryFn: async () => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        page_size: limit.toString(),
      });

      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `${API_URL}/api/moderation/queue/?${params}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch moderation queue: ${response.statusText}`,
        );
      }

      const data = await response.json();

      try {
        const validated = ModerationQueueResponseSchema.parse(data);
        return validated;
      } catch (error) {
        throw new Error("Received invalid moderation queue data from server");
      }
    },
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Get moderation queue with infinite scroll
export function useModerationQueueInfinite(
  limit: number = 10,
  search?: string,
) {
  const token = useAuthStore.getState().accessToken;

  return useInfiniteQuery({
    queryKey: ["moderation", "queue", "infinite", { limit, search }],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({
        page: pageParam.toString(),
        page_size: limit.toString(),
      });

      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `${API_URL}/api/moderation/queue/?${params}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch moderation queue: ${response.statusText}`,
        );
      }

      const data = await response.json();

      try {
        const validated = ModerationQueueResponseSchema.parse(data);
        return validated;
      } catch (error) {
        throw new Error("Received invalid moderation queue data from server");
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
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Get moderation history
export function useModerationHistory(page: number = 1, limit: number = 20) {
  const token = useAuthStore.getState().accessToken;

  return useQuery({
    queryKey: ["moderation", "history", { page, limit }],
    queryFn: async () => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/moderation/history/?page=${page}&page_size=${limit}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch moderation history: ${response.statusText}`,
        );
      }

      const data = await response.json();

      try {
        return z.array(ModerationHistoryItemSchema).parse(data);
      } catch (error) {
        throw new Error("Received invalid moderation history from server");
      }
    },
  });
}

// Moderate a post
export function useModeratePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      action: _action,
      reason,
    }: {
      postId: number;
      action: "approve" | "reject";
      reason?: string;
    }) => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/moderation/${postId}/quick-action/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(parseErrorResponse(error));
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["moderation"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

// Bulk moderation
export function useBulkModeration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postIds,
      action,
      reason,
    }: {
      postIds: number[];
      action: "approve" | "reject";
      reason?: string;
    }) => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/moderation/bulk-action/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          post_ids: postIds,
          action,
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(parseErrorResponse(error));
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["moderation"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
