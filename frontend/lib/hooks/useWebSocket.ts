/**
 * React hooks for WebSocket integration
 * NOTE: WebSocket functionality is currently disabled in favor of polling
 */

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";

// Placeholder types until WebSocket is re-enabled
type ConnectionStatus = "connected" | "disconnected" | "error";
type WebSocketEvents = Record<string, (...args: unknown[]) => void>;

/**
 * Connect to WebSocket and handle authentication
 * Currently disabled - using polling instead
 */
export function useWebSocketConnection() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const previousTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // WebSocket connection disabled - using polling instead
    return () => {
      // Cleanup
    };
  }, [isAuthenticated, token]);

  // Invalidate React Query cache on "reconnection"
  useEffect(() => {
    // When we would reconnect, invalidate all queries
    if (previousTokenRef.current !== token) {
      previousTokenRef.current = token || undefined;
      queryClient.invalidateQueries();
    }
  }, [token, queryClient]);
}

/**
 * Hook to get WebSocket connection state
 * Always returns 'disconnected' since WebSocket is disabled
 */
export function useConnectionState(): ConnectionStatus {
  return "disconnected";
}

/**
 * Subscribe to WebSocket events
 * Currently a no-op since WebSocket is disabled
 */
export function useWebSocketEvent<K extends keyof WebSocketEvents>(
  event: K,
  callback: WebSocketEvents[K],
  deps: React.DependencyList = [],
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // WebSocket events disabled - using polling instead
    return () => {
      // Cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * Subscribe to a specific post's updates
 * Currently a no-op since WebSocket is disabled
 */
export function usePostSubscription(postId: number | undefined) {
  useEffect(() => {
    if (!postId) {
      return undefined;
    }

    // WebSocket subscription disabled - using polling instead
    return () => {
      // Cleanup
    };
  }, [postId]);
}

/**
 * Subscribe to a feed's updates
 * Currently a no-op since WebSocket is disabled
 */
export function useFeedSubscription(
  feedType: "live" | "verification" | "rejected",
) {
  useEffect(() => {
    // WebSocket subscription disabled - using polling instead
    return () => {
      // Cleanup
    };
  }, [feedType]);
}

/**
 * Hook for real-time post updates
 * Currently uses polling instead of WebSocket
 */
export function useRealtimePost(postId: number | undefined) {
  const queryClient = useQueryClient();
  usePostSubscription(postId);

  const _handlePostUpdate = useCallback(() => {
    if (postId) {
      // Invalidate the specific post data
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    }
  }, [postId, queryClient]);

  // These event handlers are disabled since WebSocket is disabled
  useWebSocketEvent("post:updated", () => {
    // No-op
  });

  useWebSocketEvent("post:statusChanged", () => {
    // No-op
  });

  useWebSocketEvent("ai:analysisCompleted", () => {
    // No-op
  });

  useWebSocketEvent("verification:voteAdded", () => {
    // No-op
  });
}
