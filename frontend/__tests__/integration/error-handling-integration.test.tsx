import React from "react";
import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockAuthStore,
} from "@/lib/test-utils";
import SubmitPage from "@/app/(protected)/submit/page";
import VerifyPage from "@/app/(protected)/verify/page";
import { FeedCardWithImage } from "@/components/feed/feed-card-with-image";
import { AuthForm } from "@/components/auth/auth-form";
import { mockApiResponses } from "@/lib/test-utils";
import { PostFeedItem } from "@/lib/types";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// Mock hooks for error scenarios
jest.mock("@/hooks/usePosts", () => ({
  useCreatePost: () => ({
    createPost: jest.fn().mockImplementation(async () => {
      throw new Error("Network error");
    }),
  }),
}));

jest.mock("@/hooks/useVerification", () => ({
  useVote: () => ({
    vote: jest.fn().mockImplementation(async () => {
      throw new Error("Vote failed");
    }),
    isVoting: false,
  }),
}));

describe("Error Handling Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockAuthStore(true, mockApiResponses.login.success.user);
  }) as any;

  describe("Network Error Handling", () => {
    it("should handle network failure during post submission", async () => {
      const user = setupUser();

      // Mock network failure
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Network request failed"));

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Test Post");
      await user.type(contentTextarea, "Test content");
      await user.click(submitButton);

      // Should show error message
      (await waitFor(() => {
        expect(screen.getByText(/Network request failed/i)).toBeInTheDocument();
      })) as any;

      // Form should still be visible for retry
      expect(titleInput).toHaveValue("Test Post");
      expect(contentTextarea).toHaveValue("Test content");

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();
    }) as any;

    it("should retry failed requests with exponential backoff", async () => {
      const user = setupUser();
      let attemptCount = 0;

      // Mock intermittent failures
      global.fetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockApiResponses.posts.create.success,
        }) as any;
      }) as any;

      const RetryComponent = () => {
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState("");
        const [success, setSuccess] = React.useState(false);

        const submitWithRetry = async () => {
          setLoading(true);
          setError("");

          let lastError;
          for (let i = 0; i < 3; i++) {
            try {
              const response = (await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "Test", content: "Content" }),
              })) as any;

              if (response.ok) {
                setSuccess(true);
                setLoading(false);
                return;
              }
            } catch (err) {
              lastError = err;
              // Exponential backoff
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, i) * 1000),
              );
            }
          }

          setError((lastError as Error)?.message || "Failed after 3 attempts");
          setLoading(false);
        };

        return (
          <div>
            {loading && <div>Retrying... Attempt {attemptCount}</div>}
            {error && <div role="alert">{error}</div>}
            {success && <div>Success!</div>}
            <button onClick={submitWithRetry}>Submit with Retry</button>
          </div>
        );
      };

      jest.useFakeTimers();
      render(<RetryComponent />);

      await user.click(
        screen.getByRole("button", { name: /submit with retry/i }),
      );

      // Should show retrying
      expect(screen.getByText(/Retrying/i)).toBeInTheDocument();

      // Fast-forward through retries
      (await waitFor(() => {
        jest.advanceTimersByTime(7000); // 1s + 2s + 4s
      })) as any;

      // Should succeed after retries
      (await waitFor(() => {
        expect(screen.getByText(/Success!/i)).toBeInTheDocument();
      })) as any;

      expect(global.fetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    }) as any;

    it("should handle timeout errors gracefully", async () => {
      const user = setupUser();

      // Mock timeout
      global.fetch = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 100);
        }) as any;
      }) as any;

      const TimeoutComponent = () => {
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState("");

        const makeRequest = async () => {
          setLoading(true);
          setError("");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            (await fetch("/api/posts", {
              signal: controller.signal,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "Test", content: "Content" }),
            })) as any;
          } catch (err: any) {
            if (err.name === "AbortError") {
              setError("Request timed out. Please try again.");
            } else {
              setError(err.message);
            }
          } finally {
            clearTimeout(timeoutId);
            setLoading(false);
          }
        };

        return (
          <div>
            {loading && <div>Loading...</div>}
            {error && <div role="alert">{error}</div>}
            <button onClick={makeRequest}>Make Request</button>
          </div>
        );
      };

      render(<TimeoutComponent />);

      await user.click(screen.getByRole("button", { name: /make request/i }));

      (await waitFor(() => {
        expect(screen.getByText(/Request timeout/i)).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Session Timeout Handling", () => {
    it("should handle session expiry during form submission", async () => {
      const user = setupUser();

      // Mock 401 unauthorized response
      global.fetch = mockFetch({
        "POST /api/posts": {
          error: { detail: "Token expired" },
          status: 401,
        },
      }) as any;

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Test Post");
      await user.type(contentTextarea, "Test content");

      // Simulate token expiry
      mockAuthStore(false);

      await user.click(submitButton);

      // Should show session expired message
      (await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      })) as any;

      // Should redirect to login
      (await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/auth/login?redirect=/submit");
      })) as any;
    }) as any;

    it("should preserve form data after session refresh", async () => {
      const user = setupUser();

      // Mock localStorage for draft
      const draftData = {
        title: "Preserved Title",
        content: "Preserved Content",
        savedAt: new Date().toISOString(),
      };

      Storage.prototype.setItem = jest.fn();
      Storage.prototype.getItem = jest
        .fn()
        .mockReturnValue(JSON.stringify(draftData));

      const FormWithDraft = () => {
        const [title, setTitle] = React.useState("");
        const [content, setContent] = React.useState("");

        React.useEffect(() => {
          const savedDraft = localStorage.getItem("post-draft");
          if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            setTitle(draft.title);
            setContent(draft.content);
          }
        }, []);

        const saveDraft = () => {
          localStorage.setItem(
            "post-draft",
            JSON.stringify({
              title,
              content,
              savedAt: new Date().toISOString(),
            }),
          );
        };

        return (
          <form>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveDraft();
              }}
              placeholder="Title"
            />
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                saveDraft();
              }}
              placeholder="Content"
            />
          </form>
        );
      };

      render(<FormWithDraft />);

      // Should restore draft
      (await waitFor(() => {
        expect(screen.getByDisplayValue("Preserved Title")).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Preserved Content"),
        ).toBeInTheDocument();
      })) as any;

      // Type new content
      const titleInput = screen.getByPlaceholderText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, "Updated Title");

      // Should save to localStorage
      expect(Storage.prototype.setItem).toHaveBeenCalledWith(
        "post-draft",
        expect.stringContaining("Updated Title"),
      );
    }) as any;
  }) as any;

  describe("Concurrent Update Conflicts", () => {
    it("should handle optimistic update conflicts", async () => {
      const user = setupUser();
      const post: PostFeedItem = {
        ...mockApiResponses.posts.list[0],
        vote_count: 5,
        has_user_voted: false,
        user: {
          id: 1,
          username: "testuser",
          role: "user",
        },
        source_url: "https://example.com",
        verification_score: 5,
        verification_count: 10,
      } as PostFeedItem;

      // Mock conflicting server response
      global.fetch = mockFetch({
        "POST /api/posts/1/vote": {
          error: {
            detail: "Vote conflict",
            current_vote_count: 10,
            user_has_voted: true,
          },
          status: 409,
        },
      }) as any;

      render(<FeedCardWithImage post={post} />);

      // Initial state
      expect(screen.getByText(/5 votes/i)).toBeInTheDocument();

      const voteButton = screen.getByRole("button", { name: /vote/i }) as any;
      await user.click(voteButton);

      // Should show optimistic update briefly
      expect(screen.getByText(/6 votes/i)).toBeInTheDocument();

      // Should revert and show server state
      (await waitFor(() => {
        expect(screen.getByText(/10 votes/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /voted/i })).toBeDisabled();
      })) as any;
    }) as any;

    it("should handle race conditions in rapid voting", async () => {
      const user = setupUser();
      let voteCount = 5;

      // Mock server with artificial delay
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes("/vote")) {
          return new Promise((resolve) => {
            setTimeout(() => {
              voteCount++;
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  message: "Vote recorded",
                  new_vote_count: voteCount,
                }),
              }) as any;
            }, 100);
          }) as any;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        }) as any;
      }) as any;

      const RapidVoteComponent = () => {
        const [votes, setVotes] = React.useState(5);
        const [isVoting, setIsVoting] = React.useState(false);
        const voteQueue = React.useRef<Promise<void>>(Promise.resolve());

        const handleVote = async () => {
          if (isVoting) {
            return;
          }

          setIsVoting(true);
          setVotes((v) => v + 1); // Optimistic update

          // Queue votes to prevent race conditions
          voteQueue.current = voteQueue.current.then(async () => {
            try {
              const response = (await fetch("/api/posts/1/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              })) as any;
              const data = await response.json();
              setVotes(data.new_vote_count);
            } catch (error) {
              setVotes((v) => v - 1); // Revert on error
            } finally {
              setIsVoting(false);
            }
          }) as any;
        };

        return (
          <div>
            <span>{votes} votes</span>
            <button onClick={handleVote} disabled={isVoting}>
              {isVoting ? "Voting..." : "Vote"}
            </button>
          </div>
        );
      };

      render(<RapidVoteComponent />);

      const voteButton = screen.getByRole("button", { name: /vote/i }) as any;

      // Rapid clicks
      await user.click(voteButton);
      await user.click(voteButton);
      await user.click(voteButton);

      // Should only process one vote at a time
      (await waitFor(() => {
        expect(screen.getByText(/voting/i)).toBeInTheDocument();
      })) as any;

      // Final state should be accurate
      await waitFor(
        () => {
          expect(screen.getByText(/6 votes/i)).toBeInTheDocument();
          expect(global.fetch).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );
    }) as any;
  }) as any;

  describe("Form Validation Errors", () => {
    it("should show inline validation errors without losing form data", async () => {
      const user = setupUser();

      const FormWithValidation = () => {
        const [formData, setFormData] = React.useState({
          title: "",
          content: "",
        }) as any;
        const [errors, setErrors] = React.useState<Record<string, string>>(
          {},
        ) as any;

        const validate = () => {
          const newErrors: Record<string, string> = {};

          if (!formData.title) {
            newErrors.title = "Title is required";
          } else if (formData.title.length < 5) {
            newErrors.title = "Title must be at least 5 characters";
          } else if (formData.title.length > 200) {
            newErrors.title = "Title must be 200 characters or less";
          }

          if (!formData.content) {
            newErrors.content = "Content is required";
          } else if (formData.content.length < 10) {
            newErrors.content = "Content must be at least 10 characters";
          } else if (formData.content.length > 5000) {
            newErrors.content = "Content must be 5000 characters or less";
          }

          setErrors(newErrors);
          return Object.keys(newErrors).length === 0;
        };

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (validate()) {
            // Submit logic
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <div>
              <input
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value }) as any;
                  if (errors.title) {
                    validate();
                  }
                }}
                placeholder="Title"
                aria-invalid={!!errors.title}
              />
              {errors.title && <span role="alert">{errors.title}</span>}
            </div>
            <div>
              <textarea
                value={formData.content}
                onChange={(e) => {
                  setFormData({ ...formData, content: e.target.value }) as any;
                  if (errors.content) {
                    validate();
                  }
                }}
                placeholder="Content"
                aria-invalid={!!errors.content}
              />
              {errors.content && <span role="alert">{errors.content}</span>}
            </div>
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<FormWithValidation />);

      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      // Try empty submission
      await user.click(submitButton);

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/content is required/i)).toBeInTheDocument();

      // Type short values
      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentTextarea = screen.getByPlaceholderText(/content/i);

      await user.type(titleInput, "Test");
      await user.type(contentTextarea, "Short");

      // Should show length errors
      expect(
        screen.getByText(/title must be at least 5 characters/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/content must be at least 10 characters/i),
      ).toBeInTheDocument();

      // Fix validation
      await user.type(titleInput, "ing");
      await user.type(contentTextarea, " content here");

      // Errors should clear
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }) as any;

    it("should handle server-side validation errors", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "POST /api/posts": {
          error: {
            detail: "Validation error",
            errors: {
              title: ["Title contains prohibited words"],
              content: ["Content is too similar to existing post"],
            },
          },
          status: 422,
        },
      }) as any;

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Prohibited Title");
      await user.type(contentTextarea, "Duplicate content");
      await user.click(submitButton);

      // Should show server errors
      (await waitFor(() => {
        expect(
          screen.getByText(/Title contains prohibited words/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Content is too similar to existing post/i),
        ).toBeInTheDocument();
      })) as any;

      // Form data should be preserved
      expect(titleInput).toHaveValue("Prohibited Title");
      expect(contentTextarea).toHaveValue("Duplicate content");
    }) as any;
  }) as any;

  describe("Error Recovery UI", () => {
    it("should provide clear recovery actions for errors", async () => {
      const user = setupUser();

      const ErrorRecoveryComponent = () => {
        const [error, setError] = React.useState<{
          type: string;
          message: string;
        } | null>(null);
        const [retrying, setRetrying] = React.useState(false);

        const simulateError = (type: string) => {
          setError({
            type,
            message:
              type === "network"
                ? "Network connection lost"
                : "Session expired",
          }) as any;
        };

        const handleRetry = async () => {
          setRetrying(true);
          // Simulate retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setError(null);
          setRetrying(false);
        };

        if (error) {
          return (
            <div role="alert" aria-live="assertive">
              <h2>Something went wrong</h2>
              <p>{error.message}</p>
              {error.type === "network" && (
                <div>
                  <p>Please check your internet connection and try again.</p>
                  <button onClick={handleRetry} disabled={retrying}>
                    {retrying ? "Retrying..." : "Retry"}
                  </button>
                </div>
              )}
              {error.type === "auth" && (
                <div>
                  <p>You need to log in again to continue.</p>
                  <button onClick={() => mockPush("/auth/login")}>
                    Go to Login
                  </button>
                </div>
              )}
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          );
        }

        return (
          <div>
            <button onClick={() => simulateError("network")}>
              Simulate Network Error
            </button>
            <button onClick={() => simulateError("auth")}>
              Simulate Auth Error
            </button>
          </div>
        );
      };

      render(<ErrorRecoveryComponent />);

      // Test network error recovery
      await user.click(
        screen.getByRole("button", { name: /simulate network error/i }),
      );

      expect(screen.getByText(/network connection lost/i)).toBeInTheDocument();
      expect(
        screen.getByText(/check your internet connection/i),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /retry/i }));

      expect(screen.getByText(/retrying/i)).toBeInTheDocument();

      (await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      })) as any;

      // Test auth error recovery
      await user.click(
        screen.getByRole("button", { name: /simulate auth error/i }),
      );

      expect(screen.getByText(/session expired/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /go to login/i }));

      expect(mockPush).toHaveBeenCalledWith("/auth/login");
    }) as any;
  }) as any;
}) as any;
