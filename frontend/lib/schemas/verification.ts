import { z } from "zod";

export const VerificationVoteTypeSchema = z.enum(["positive", "negative"]);

export const VerificationStatsSchema = z.object({
  post_id: z.number(),
  total_votes: z.number(),
  positive_votes: z.number(),
  negative_votes: z.number(),
  verification_score: z.number(),
  user_vote: VerificationVoteTypeSchema.nullable(),
});

export const VerificationVoteSchema = z.object({
  id: z.number(),
  user: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().email().optional(),
  }),
  post_id: z.number(),
  vote_type: VerificationVoteTypeSchema,
  reason: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export const VerificationVoteCreateSchema = z.object({
  vote_type: VerificationVoteTypeSchema,
  reason: z.string().optional(),
});

export type VerificationStats = z.infer<typeof VerificationStatsSchema>;
export type VerificationVote = z.infer<typeof VerificationVoteSchema>;
export type VerificationVoteCreate = z.infer<
  typeof VerificationVoteCreateSchema
>;
export type VerificationVoteType = z.infer<typeof VerificationVoteTypeSchema>;
