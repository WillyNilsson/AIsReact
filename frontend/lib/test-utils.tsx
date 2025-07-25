import React from "react";
import {
  render as rtlRender,
  RenderOptions,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

// Mock providers
interface ProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: ProvidersProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Custom render function that includes providers
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

// Mock API responses
export const mockApiResponses = {
  login: {
    success: {
      access_token: "mock-jwt-token",
      user: {
        id: 1,
        email: "test@example.com",
        username: "testuser",
        is_admin: false,
        created_at: "2024-01-01T00:00:00Z",
      },
    },
    failure: {
      detail: "Invalid credentials",
    },
  },
  posts: {
    list: [
      {
        id: 1,
        title: "Test Post 1",
        content: "Content for test post 1",
        author_id: 1,
        author_username: "testuser",
        status: "verified",
        created_at: "2024-01-01T00:00:00Z",
        vote_count: 5,
        has_user_voted: false,
        ai_responses: [],
      },
      {
        id: 2,
        title: "Test Post 2",
        content: "Content for test post 2",
        author_id: 2,
        author_username: "otheruser",
        status: "verified",
        created_at: "2024-01-02T00:00:00Z",
        vote_count: 3,
        has_user_voted: true,
        ai_responses: [],
      },
    ],
    create: {
      success: {
        id: 3,
        title: "New Post",
        content: "New post content",
        status: "pending_moderation",
        created_at: "2024-01-03T00:00:00Z",
      },
      moderation_failure: {
        detail: "Content violates community guidelines",
        violations: ["spam", "inappropriate_content"],
      },
    },
  },
  verification: {
    posts: [
      {
        id: 4,
        title: "Post to Verify",
        content: "Content awaiting verification",
        author_username: "user123",
        created_at: "2024-01-01T00:00:00Z",
        vote_count: 2,
        has_user_voted: false,
      },
    ],
    vote: {
      success: {
        message: "Vote recorded successfully",
        new_vote_count: 3,
      },
      failure: {
        detail: "You have already voted on this post",
      },
    },
  },
  aiAnalysis: {
    inProgress: {
      post_id: 1,
      status: "processing",
      providers: {
        openai: { status: "processing", progress: 50 },
        anthropic: { status: "pending", progress: 0 },
        google: { status: "pending", progress: 0 },
        xai: { status: "pending", progress: 0 },
        deepseek: { status: "pending", progress: 0 },
      },
    },
    completed: {
      post_id: 1,
      status: "completed",
      providers: {
        openai: {
          status: "completed",
          response: "OpenAI analysis of the post...",
          timestamp: "2024-01-01T00:00:00Z",
        },
        anthropic: {
          status: "completed",
          response: "Anthropic analysis of the post...",
          timestamp: "2024-01-01T00:01:00Z",
        },
        google: {
          status: "completed",
          response: "Google analysis of the post...",
          timestamp: "2024-01-01T00:02:00Z",
        },
        xai: {
          status: "failed",
          error: "Provider timeout",
          timestamp: "2024-01-01T00:03:00Z",
        },
        deepseek: {
          status: "completed",
          response: "DeepSeek analysis of the post...",
          timestamp: "2024-01-01T00:04:00Z",
        },
      },
    },
  },
};

// Mock fetch implementation
export function mockFetch(responses: Record<string, unknown>) {
  return jest.fn((url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    const path = url.replace(/^https?:\/\/[^\/]+/, "");

    const key = `${method} ${path}`;
    const response = responses[key] as
      | { error?: unknown; status?: number; data?: unknown }
      | undefined;

    if (!response) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      });
    }

    if (response?.error) {
      return Promise.resolve({
        ok: false,
        status: response.status || 400,
        json: async () => response.error,
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => response.data,
    });
  });
}

// Helper to wait for async updates
export async function waitForAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// Helper to setup user event
export function setupUser() {
  return userEvent.setup();
}

// Mock auth store
export function mockAuthStore(
  isAuthenticated: boolean = false,
  user: unknown = null,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const authStore = require("@/store/authStore");

  // Create a mock store state
  const mockState = {
    isAuthenticated,
    user,
    token: isAuthenticated ? "mock-jwt-token" : null,
    login: jest.fn().mockImplementation(async () => {
      authStore.useAuthStore.setState({
        isAuthenticated: true,
        user: mockApiResponses.login.success.user,
        token: "mock-jwt-token",
      });
    }),
    logout: jest.fn().mockImplementation(() => {
      authStore.useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
      });
    }),
    register: jest.fn(),
    checkAuth: jest.fn(),
  };

  // Set the state
  authStore.useAuthStore.setState(mockState);
}

// Export everything
export * from "@testing-library/react";
export { customRender as render };
