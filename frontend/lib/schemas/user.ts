import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email().optional(), // Made optional for privacy
  full_name: z.string().optional(),
  role: z.enum(["user", "moderator", "admin"]).default("user"),
  is_active: z.boolean().optional().default(true),
  is_verified: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string().optional(), // Made optional since not always returned
});

export type User = z.infer<typeof UserSchema>;
