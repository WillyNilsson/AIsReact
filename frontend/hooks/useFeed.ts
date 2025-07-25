import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PostSchema } from "@/lib/schemas/post";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Schema for paginated feed response
const FeedResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(PostSchema),
});

export type FeedResponse = z.infer<typeof FeedResponseSchema>;

interface UseFeedOptions {
  search?: string;
  perPage?: number;
}

export function useLiveFeed(options?: UseFeedOptions) {
  const { search, perPage = 20 } = options || {};
  const token = useAuthStore.getState().accessToken;

  return useInfiniteQuery({
    queryKey: ["feed", "live", { search, perPage }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        page_size: perPage.toString(),
      });

      if (search) {
        params.append("search", search);
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/feed/live/?${params}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Return empty response for 404
          return {
            count: 0,
            next: null,
            previous: null,
            results: [],
          };
        }
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      const data = await response.json();

      try {
        return FeedResponseSchema.parse(data);
      } catch (error) {
        throw new Error("Received invalid feed data from server");
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.next) {
        return undefined;
      }
      return allPages.length + 1;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRejectedFeed(options?: { perPage?: number }) {
  const { perPage = 20 } = options || {};
  const token = useAuthStore.getState().accessToken;

  return useInfiniteQuery({
    queryKey: ["feed", "rejected", { perPage }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/feed/rejected/?page=${pageParam}&page_size=${perPage}`,
        { headers },
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Return empty response for 404
          return {
            count: 0,
            next: null,
            previous: null,
            results: [],
          };
        }
        throw new Error(
          `Failed to fetch rejected feed: ${response.statusText}`,
        );
      }

      const data = await response.json();

      try {
        return FeedResponseSchema.parse(data);
      } catch (error) {
        throw new Error("Received invalid feed data from server");
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.next) {
        return undefined;
      }
      return allPages.length + 1;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper hook to flatten infinite query data and provide familiar API
export function useFeedData(
  infiniteQuery: ReturnType<typeof useLiveFeed | typeof useRejectedFeed>,
) {
  const { data, ...rest } = infiniteQuery;

  const posts = data?.pages.flatMap((page) => page.results) || [];
  const totalCount = data?.pages[0]?.count || 0;
  const isEmpty = posts.length === 0;
  const isReachingEnd = !infiniteQuery.hasNextPage;

  return {
    posts,
    totalCount,
    isEmpty,
    isReachingEnd,
    ...rest,
  };
}
