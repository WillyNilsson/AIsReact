import { z } from "zod";

export const AIResponseDataSchema = z.object({
  summary: z.string().default(""),
  impact_assessment: z.string().optional(),
  objectivity_analysis: z.string().optional(),
  key_quotes: z.array(z.string()).optional(),
  // New fields from backend
  historical_context: z.string().optional(),
  future_development: z.string().optional(),
  opinions: z.string().optional(),
  _fallback: z.boolean().optional(),
});

export const AIResponseSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  model_name: z.string(),
  response_data: AIResponseDataSchema.nullable(),
  response_time_ms: z.number().nullable().optional(),
  token_count: z.number().nullable().optional(),
  error_message: z.string().nullable().optional(),
  created_at: z.string(),
  is_successful: z.boolean(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIResponseData = z.infer<typeof AIResponseDataSchema>;
