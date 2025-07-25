import { useQuery } from "@tanstack/react-query";
import { PostSchema } from "@/lib/schemas/post";
import { useAuthStore } from "@/store/authStore";
import { z } from "zod";
import { logger } from "@/lib/logger";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class PostNotFoundError extends Error {
  constructor(postId: number) {
    super(`Post with ID ${postId} not found`);
    this.name = "PostNotFoundError";
  }
}

export class PostFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "PostFetchError";
  }
}

export function usePost(
  postId: number | null,
  options?: { refetchInterval?: number },
) {
  return useQuery({
    queryKey: ["post", postId],
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

      const response = await fetch(`${API_URL}/api/posts/${postId}/`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new PostNotFoundError(postId);
        }
        throw new PostFetchError(
          `Failed to fetch post: ${response.statusText}`,
          response.status,
        );
      }

      const data = await response.json();

      // Validate and transform the response
      try {
        return PostSchema.parse(data);
      } catch (error) {
        logger.error("Post validation error", error, {
          receivedData: data,
          validationErrors:
            error instanceof z.ZodError ? error.errors : undefined,
        });
        throw new PostFetchError("Received invalid post data from server");
      }
    },
    enabled: !!postId,
    refetchInterval: options?.refetchInterval,
    retry: (failureCount, error) => {
      // Don't retry on 404 or validation errors
      if (error instanceof PostNotFoundError) {
        return false;
      }
      if (error instanceof PostFetchError && error.status === 404) {
        return false;
      }
      if (error.message.includes("invalid post data")) {
        return false;
      }

      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });
}
