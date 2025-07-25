import { z } from "zod";
import { PostFeedItemSchema } from "./post";

export const FeedResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(PostFeedItemSchema),
});

export type FeedResponse = z.infer<typeof FeedResponseSchema>;
