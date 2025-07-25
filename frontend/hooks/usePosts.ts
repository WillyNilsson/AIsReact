import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PostSchema } from "@/lib/schemas/post";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Schema for paginated response
const PaginatedPostsSchema = z.object({
  results: z.array(PostSchema),
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
});

export type PaginatedPosts = z.infer<typeof PaginatedPostsSchema>;

interface UsePostsOptions {
  status?: string;
  page?: number;
  limit?: number;
}

export function usePosts(options: UsePostsOptions = {}) {
  const { status = "live", page = 1, limit = 10 } = options;

  return useQuery({
    queryKey: ["posts", { status, page, limit }],
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({
        status,
        page: page.toString(),
        page_size: limit.toString(),
      });

      const response = await fetch(`${API_URL}/api/posts/?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate and transform the response
      try {
        return PaginatedPostsSchema.parse(data);
      } catch (error) {
        throw new Error("Received invalid posts data from server");
      }
    },
    staleTime: 1 * 60 * 1000, // Consider data fresh for 1 minute
  });
}

// Infinite scroll version for user posts
export function usePostsInfinite(
  options: { status?: string; limit?: number } = {},
) {
  const { status, limit = 10 } = options;
  const token = useAuthStore.getState().accessToken;

  return useInfiniteQuery({
    queryKey: ["posts", "infinite", { status, limit }],
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

      if (status) {
        params.append("status", status);
      }

      const response = await fetch(`${API_URL}/api/posts/?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate and transform the response
      try {
        return PaginatedPostsSchema.parse(data);
      } catch (error) {
        throw new Error("Received invalid posts data from server");
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
    staleTime: 1 * 60 * 1000,
  });
}
