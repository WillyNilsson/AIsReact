/**
 * API-related type definitions
 */

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// File upload types
export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
  file_url: string;
}

// Moderation action data
export interface ModerationActionData {
  action: "approve" | "reject" | "remove";
  rejection_reason?: string;
}

export interface BulkModerationData extends ModerationActionData {
  post_ids: number[];
}

// Generic data payload for API requests
export type ApiRequestData = Record<string, unknown>;

// API client method types
export type ApiGetMethod = <T = unknown>(url: string) => Promise<T>;
export type ApiPostMethod = <T = unknown>(
  url: string,
  data?: ApiRequestData,
) => Promise<T>;
export type ApiPutMethod = <T = unknown>(
  url: string,
  data?: ApiRequestData,
) => Promise<T>;
export type ApiDeleteMethod = <T = unknown>(url: string) => Promise<T>;
