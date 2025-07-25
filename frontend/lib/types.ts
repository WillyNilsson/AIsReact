// User types
export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  role: "user" | "moderator" | "admin";
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at?: string;
  // Profile fields
  bio?: string;
  avatar_url?: string | null;
  website_url?: string | null;
  twitter_username?: string;
  github_username?: string;
}

// Post types
export enum ContentType {
  TEXT = "text",
  IMAGE = "image",
}

// Moderation result from AI moderation
export interface ModerationResult {
  is_safe: boolean;
  categories?: {
    hate?: boolean;
    violence?: boolean;
    sexual?: boolean;
    harassment?: boolean;
    self_harm?: boolean;
    [key: string]: boolean | undefined;
  };
  scores?: {
    [key: string]: number;
  };
  flagged_content?: string[];
  reason?: string;
}

export type PostStatus =
  | "pending_moderation"
  | "pending_verification"
  | "rejected"
  | "live"
  | "disputed"
  | "removed";

// For backward compatibility
export const PostStatus = {
  PENDING_MODERATION: "pending_moderation" as const,
  PENDING_VERIFICATION: "pending_verification" as const,
  REJECTED: "rejected" as const,
  LIVE: "live" as const,
  DISPUTED: "disputed" as const,
  REMOVED: "removed" as const,
} as const;

export interface PostCreate {
  title: string;
  content: string;
  source_url: string;
  image_url?: string;
}

export interface Post {
  id: number;
  user: User;
  title: string;
  content: string;
  source_url: string;
  image_url?: string | null;
  status: PostStatus;
  moderation_result?: ModerationResult;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  verified_at?: string | null;
  ai_responses?: AIResponse[];
  verification_score: number;
  verification_count: number;

  // Legacy fields for compatibility
  content_type?: ContentType;
  content_text?: string;
  image_s3_key?: string;
  user_id?: number;
  verification_positive?: number;
  verification_negative?: number;
}

export interface PostWithVotes extends Post {
  user_vote?: boolean;
}

export interface PostFeedItem {
  id: number;
  user: Pick<User, "id" | "username" | "role"> & {
    email?: string;
    full_name?: string;
    is_active?: boolean;
    is_verified?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  title: string;
  content: string;
  source_url: string;
  image_url?: string | null;
  status: PostStatus;
  created_at: string;
  verification_score: number;
  verification_count: number;
  rejection_reason?: string | null;
  ai_response_count?: number;
  user_vote?: boolean | null;
  ai_summary?: string | null;
}

// AI Response types
export interface AIResponse {
  id: number;
  post_id: number;
  model_name: string;
  response_data: {
    summary: string;
    historical_context?: string;
    future_development?: string;
    opinions?: string;
    impact_assessment?: string;
    objectivity_analysis?: string;
    key_quotes?: string | string[];
    _fallback?: boolean;
  } | null;
  response_time_ms?: number | null;
  token_count?: number | null;
  error_message?: string | null;
  created_at: string;
  is_successful: boolean;
}

// Verification types
export interface VerificationVote {
  id: number;
  post_id: number;
  user_id: number;
  vote: boolean;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface VerificationVoteCreate {
  vote: boolean;
  comment?: string;
}

export interface VerificationStats {
  total_votes: number;
  positive_votes: number;
  negative_votes: number;
  verification_score: number;
  user_vote?: "positive" | "negative" | null;
}

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// API Response types
export interface ApiError {
  detail: string;
  [key: string]: unknown;
}
