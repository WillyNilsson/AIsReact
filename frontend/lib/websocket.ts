/**
 * WebSocket service for real-time updates
 */

import { io, Socket } from "socket.io-client";
import { Post, AIResponse } from "./types";
import { logger } from "./logger";

export interface WebSocketEvents {
  // Post events
  "post:created": (post: Post) => void;
  "post:updated": (post: Post) => void;
  "post:statusChanged": (data: { postId: number; status: string }) => void;

  // AI analysis events
  "ai:analysisStarted": (data: { postId: number; aiModel: string }) => void;
  "ai:analysisCompleted": (data: {
    postId: number;
    response: AIResponse;
  }) => void;
  "ai:analysisError": (data: {
    postId: number;
    aiModel: string;
    error: string;
  }) => void;

  // Verification events
  "verification:voteAdded": (data: {
    postId: number;
    positive: number;
    negative: number;
  }) => void;
  "verification:thresholdReached": (data: {
    postId: number;
    status: "approved" | "rejected";
  }) => void;

  // Connection events
  connect: () => void;
  disconnect: () => void;
  error: (error: Error) => void;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface ConnectionState {
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastError?: string;
  nextReconnectTime?: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<
    keyof WebSocketEvents,
    Set<(...args: unknown[]) => void>
  > = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = {
    status: "disconnected",
    reconnectAttempts: 0,
  };
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private subscribedPosts = new Set<number>();
  private subscribedFeeds = new Set<"live" | "verification" | "rejected">();
  private lastToken: string | undefined;
  private isIntentionalDisconnect = false;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  connect(token?: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.lastToken = token;
    this.isIntentionalDisconnect = false;
    this.updateConnectionState({
      status: "connecting",
      reconnectAttempts: this.reconnectAttempts,
    });

    // Use relative URL to go through Next.js proxy
    const wsUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    this.socket = io(wsUrl, {
      path: "/ws",
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnection: false, // We'll handle reconnection manually
      timeout: 20000,
      forceNew: true,
    });

    this.setupEventHandlers();
    this.setupNetworkHandlers();
  }

  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.clearReconnectTimer();
    this.clearNetworkHandlers();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.subscribedPosts.clear();
    this.subscribedFeeds.clear();
    this.lastToken = undefined; // Clear sensitive data
    this.updateConnectionState({
      status: "disconnected",
      reconnectAttempts: 0,
    });
  }

  on<K extends keyof WebSocketEvents>(
    event: K,
    callback: WebSocketEvents[K],
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listeners.get(event)!.add(callback as any);

    // Also register with socket if connected
    if (this.socket) {
      this.socket.on(event as string, callback as (...args: unknown[]) => void);
    }

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  off<K extends keyof WebSocketEvents>(
    event: K,
    callback: WebSocketEvents[K],
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callbacks.delete(callback as any);
    }

    if (this.socket) {
      this.socket.off(
        event as string,
        callback as (...args: unknown[]) => void,
      );
    }
  }

  emit(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Connection handlers
    this.socket.on("connect", () => {
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.updateConnectionState({ status: "connected", reconnectAttempts: 0 });
      this.notifyListeners("connect");
      this.resubscribeToAll();
    });

    this.socket.on("disconnect", (reason) => {
      this.notifyListeners("disconnect");

      if (!this.isIntentionalDisconnect) {
        const error = this.getDisconnectReason(reason);
        this.updateConnectionState({
          status: "disconnected",
          reconnectAttempts: this.reconnectAttempts,
          lastError: error,
        });
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      const errorMessage = error.message || "Connection failed";
      this.updateConnectionState({
        status: "error",
        reconnectAttempts: this.reconnectAttempts,
        lastError: errorMessage,
      });
      this.notifyListeners("error", new Error(errorMessage));

      if (!this.isIntentionalDisconnect) {
        this.scheduleReconnect();
      }
    });

    // Re-register all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket!.on(event, callback as (...args: unknown[]) => void);
      });
    });
  }

  private notifyListeners(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event as keyof WebSocketEvents);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch {
          // Silently handle errors to prevent crashing other listeners
        }
      });
    }
  }

  // Utility methods for specific subscriptions
  subscribeToPost(postId: number): void {
    this.subscribedPosts.add(postId);
    this.emit("subscribe:post", { postId });
  }

  unsubscribeFromPost(postId: number): void {
    this.subscribedPosts.delete(postId);
    this.emit("unsubscribe:post", { postId });
  }

  subscribeToFeed(feedType: "live" | "verification" | "rejected"): void {
    this.subscribedFeeds.add(feedType);
    this.emit("subscribe:feed", { feedType });
  }

  unsubscribeFromFeed(feedType: "live" | "verification" | "rejected"): void {
    this.subscribedFeeds.delete(feedType);
    this.emit("unsubscribe:feed", { feedType });
  }

  // Connection state management
  onConnectionStateChange(
    callback: (state: ConnectionState) => void,
  ): () => void {
    this.stateListeners.add(callback);
    // Immediately notify of current state
    callback(this.connectionState);

    return () => {
      this.stateListeners.delete(callback);
    };
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // Private helper methods
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.stateListeners.forEach((listener) => {
      try {
        listener(this.connectionState);
      } catch (error) {
        logger.error("Error in connection state listener", error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateConnectionState({
        status: "error",
        lastError: "Maximum reconnection attempts reached",
      });
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    const nextReconnectTime = Date.now() + delay;
    this.updateConnectionState({
      status: "reconnecting",
      nextReconnectTime,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnect();
    }, delay);
  }

  private reconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.connect(this.lastToken);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private resubscribeToAll(): void {
    // Resubscribe to all posts
    this.subscribedPosts.forEach((postId) => {
      this.emit("subscribe:post", { postId });
    });

    // Resubscribe to all feeds
    this.subscribedFeeds.forEach((feedType) => {
      this.emit("subscribe:feed", { feedType });
    });
  }

  private setupNetworkHandlers(): void {
    if (typeof window === "undefined") {
      return;
    }

    // Handle page visibility changes
    this.visibilityHandler = () => {
      if (
        document.visibilityState === "visible" &&
        !this.socket?.connected &&
        !this.isIntentionalDisconnect
      ) {
        this.reconnect();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    // Handle online/offline events
    this.onlineHandler = () => {
      if (!this.socket?.connected && !this.isIntentionalDisconnect) {
        this.reconnect();
      }
    };
    window.addEventListener("online", this.onlineHandler);
  }

  private clearNetworkHandlers(): void {
    if (typeof window === "undefined") {
      return;
    }

    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private getDisconnectReason(reason: string): string {
    const reasons: Record<string, string> = {
      "io server disconnect": "Server disconnected",
      "io client disconnect": "Client disconnected",
      "ping timeout": "Connection timeout",
      "transport close": "Connection lost",
      "transport error": "Network error",
    };

    return reasons[reason] || `Disconnected: ${reason}`;
  }
}

// Export singleton instance
export const websocket = new WebSocketService();
