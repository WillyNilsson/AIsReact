/**
 * Maps backend AI response structure to frontend expected structure
 */

export interface BackendAIResponse {
  id: number;
  ai_model: string;
  summary: string;
  impact_assessment: string;
  objectivity_analysis: string;
  key_quotes: string;
  metadata?: {
    response_time_ms?: number;
    usage?: {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
    total_tokens?: number;
  };
  created_at: string;
}

export interface FrontendAIResponse {
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

export function mapAIResponse(
  backendResponse: BackendAIResponse,
  postId: number,
): FrontendAIResponse {
  return {
    id: backendResponse.id,
    post_id: postId,
    model_name: backendResponse.ai_model,
    response_data: {
      summary: backendResponse.summary,
      historical_context: backendResponse.impact_assessment,
      future_development: backendResponse.objectivity_analysis,
      opinions: backendResponse.key_quotes,
      _fallback: false,
    },
    response_time_ms: backendResponse.metadata?.response_time_ms,
    token_count:
      backendResponse.metadata?.usage?.total_tokens ||
      (backendResponse.metadata?.usage?.input_tokens &&
      backendResponse.metadata?.usage?.output_tokens
        ? backendResponse.metadata.usage.input_tokens +
          backendResponse.metadata.usage.output_tokens
        : undefined) ||
      backendResponse.metadata?.total_tokens,
    error_message: undefined,
    created_at: backendResponse.created_at,
    is_successful: true,
  };
}

import { Post } from "../types";

export interface BackendPost extends Omit<Post, "ai_responses"> {
  ai_responses?: BackendAIResponse[];
}

export function mapPost(backendPost: BackendPost): Post {
  if (!backendPost) {
    return backendPost as Post;
  }

  try {
    const mapped = {
      ...backendPost,
      ai_responses:
        backendPost.ai_responses?.map((response: BackendAIResponse) =>
          mapAIResponse(response, backendPost.id),
        ) || [],
    } as Post;

    return mapped;
  } catch {
    // Return null to indicate that the post is invalid
    return null as unknown as Post;
  }
}
