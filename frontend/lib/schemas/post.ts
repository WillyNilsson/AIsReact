import { z } from "zod";
import { UserSchema } from "./user";
import { AIResponseSchema } from "./ai-response";

export const PostStatusSchema = z.enum([
  "pending_moderation",
  "pending_verification",
  "live",
  "rejected",
  "disputed",
  "removed",
]);

export const ModerationResultSchema = z.object({
  is_safe: z.boolean().optional(),
  categories: z.union([z.record(z.boolean()), z.array(z.string())]).optional(),
  scores: z.record(z.number()).optional(),
  flagged_content: z.array(z.string()).optional(),
  reason: z.string().nullable().optional(),
  // Handle both OpenAI format and custom format
  flagged: z.boolean().optional(),
  category_scores: z.record(z.union([z.number(), z.null()])).optional(),
});

export const PostSchema = z.object({
  id: z.number(),
  user: UserSchema,
  title: z.string(),
  content: z.string(),
  source_url: z.string().url(),
  image_url: z.string().url().nullable().optional(),
  status: PostStatusSchema,
  moderation_result: ModerationResultSchema.nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  verified_at: z.string().nullable().optional(),
  ai_responses: z.array(AIResponseSchema).nullable().default([]),
  verification_score: z.number().default(0),
  verification_count: z.number().default(0),
  ai_summary: z.string().nullable().optional(),
});

export const PostFeedItemSchema = z.object({
  id: z.number(),
  user: UserSchema,
  title: z.string(),
  content: z.string(),
  source_url: z.string().url(),
  image_url: z.string().url().nullable().optional(),
  status: PostStatusSchema,
  created_at: z.string(),
  verification_score: z.number().default(0),
  verification_count: z.number().default(0),
  rejection_reason: z.string().nullable().optional(),
  ai_response_count: z.number().optional(),
  user_vote: z.boolean().nullable().optional(),
});

export type Post = z.infer<typeof PostSchema>;
export type PostStatus = z.infer<typeof PostStatusSchema>;
export type ModerationResult = z.infer<typeof ModerationResultSchema>;
export type PostFeedItem = z.infer<typeof PostFeedItemSchema>;
