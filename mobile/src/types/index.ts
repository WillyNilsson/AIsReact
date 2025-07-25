// Shared types between mobile and web
export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'user' | 'moderator' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export enum PostStatus {
  PENDING_MODERATION = 'pending_moderation',
  PENDING_VERIFICATION = 'pending_verification',
  REJECTED = 'rejected',
  LIVE = 'live',
  DISPUTED = 'disputed',
  REMOVED = 'removed',
}

export interface PostFeedItem {
  id: number;
  user: User;
  title: string;
  content: string;
  source_url: string;
  image_url?: string;
  status: PostStatus;
  created_at: string;
  verification_score: number;
  verification_count: number;
  rejection_reason?: string;
  ai_response_count?: number;
}

export interface Post extends PostFeedItem {
  moderation_result?: any;
  updated_at: string;
  verified_at?: string;
  ai_responses?: AIResponse[];
}

export interface AIResponse {
  id: number;
  post_id: number;
  model_name: string;
  response_data: {
    summary: string;
    historical_context: string;
    future_development: string;
    opinions: string;
    _fallback?: boolean;
  };
  response_time_ms?: number;
  token_count?: number;
  error_message?: string;
  created_at: string;
  is_successful: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

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