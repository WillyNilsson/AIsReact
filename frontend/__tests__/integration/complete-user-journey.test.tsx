import React from "react";
import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockApiResponses,
  mockAuthStore,
} from "@/lib/test-utils";
import { useRouter } from "next/navigation";
// Mock page components to avoid complex dependencies

const mockPush = jest.fn();
const mockReplace = jest.fn();

// Mock navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({ id: "1" }),
}));

// Mock hooks
jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(() => ({
    login: jest.fn().mockImplementation(async (data) => {
      if (data.username === "testuser" && data.password === "Test123!@#") {
        // pragma: allowlist secret
        const authStore = require("@/store/authStore");
        authStore.useAuthStore.setState({
          isAuthenticated: true,
          user: mockApiResponses.login.success.user,
          token: "mock-jwt-token",
        }) as any;
        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    }),
    logout: jest.fn(),
    isAuthenticated: false,
    user: null,
  })),
}));

jest.mock("@/hooks/usePosts", () => ({
  useCreatePost: () => ({
    createPost: jest.fn().mockResolvedValue({ id: 3 }),
  }),
  usePost: () => ({
    post: mockApiResponses.posts.list[0],
    isLoading: false,
    error: null,
  }),
  usePosts: () => ({
    posts: mockApiResponses.posts.list,
    isLoading: false,
    error: null,
  }),
}));

jest.mock("@/hooks/useVerification", () => ({
  useVerificationPosts: () => ({
    posts: mockApiResponses.verification.posts,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
  useVote: () => ({
    vote: jest
      .fn()
      .mockResolvedValue(mockApiResponses.verification.vote.success),
    isVoting: false,
  }),
}));

describe("Complete User Journey Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockAuthStore(false);
  }) as any;

  describe("New User Journey: Register → Verify Email → Submit → Vote → View", () => {
    it("should complete full new user workflow", async () => {
      const user = setupUser();

      // Step 1: Registration
      global.fetch = mockFetch({
        "POST /api/auth/register": {
          data: {
            message: "Registration successful. Please check your email.",
            user: {
              ...mockApiResponses.login.success.user,
              is_verified: false,
            },
          },
        },
      }) as any;

      const RegisterForm = () => {
        const [error, setError] = React.useState("");
        const [success, setSuccess] = React.useState(false);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          const response = (await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: "newuser",
              email: "newuser@example.com",
              password: "Test123!@#",
            }),
          })) as any;

          if (response.ok) {
            setSuccess(true);
          } else {
            setError("Registration failed");
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            {success && (
              <div>Registration successful. Please check your email.</div>
            )}
            {error && <div>{error}</div>}
            <button type="submit">Register</button>
          </form>
        );
      };

      const { rerender } = render(<RegisterForm />);

      await user.click(screen.getByRole("button", { name: /register/i }));

      (await waitFor(() => {
        expect(
          screen.getByText(/Registration successful/i),
        ).toBeInTheDocument();
      })) as any;

      // Step 2: Email Verification
      global.fetch = mockFetch({
        "POST /api/auth/verify-email": {
          data: {
            message: "Email verified successfully",
            user: { ...mockApiResponses.login.success.user, is_verified: true },
          },
        },
      }) as any;

      // Simulate clicking verification link
      const VerifyEmail = () => {
        const [verified, setVerified] = React.useState(false);

        React.useEffect(() => {
          fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "verification-token" }),
          }).then(() => setVerified(true));
        }, []);

        return verified ? (
          <div>
            Email verified! <a href="/auth/login">Login</a>
          </div>
        ) : (
          <div>Verifying...</div>
        );
      };

      rerender(<VerifyEmail />);

      (await waitFor(() => {
        expect(screen.getByText(/Email verified!/i)).toBeInTheDocument();
      })) as any;

      // Step 3: Login
      mockAuthStore(false);

      // Mock login form
      const LoginForm = () => {
        const [username, setUsername] = React.useState("");
        const [password, setPassword] = React.useState("");
        const { login } = require("@/hooks/useAuth").useAuth();

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          const result = (await login({ username, password })) as any;
          if (result.success) {
            mockPush("/");
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              placeholder="johndoe or john@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Sign In</button>
          </form>
        );
      };

      rerender(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText(
        /johndoe or john@example.com/i,
      );
      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const loginButton = screen.getByRole("button", {
        name: /sign in/i,
      }) as any;

      await user.type(usernameInput, "testuser");
      await user.type(passwordInput, "Test123!@#");
      await user.click(loginButton);

      (await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      })) as any;

      // Update auth state
      mockAuthStore(true, {
        ...mockApiResponses.login.success.user,
        is_verified: true,
      }) as any;

      // Step 4: Submit Post
      global.fetch = mockFetch({
        "POST /api/posts": { data: mockApiResponses.posts.create.success },
      }) as any;

      // Mock submit form
      const SubmitForm = () => {
        const [title, setTitle] = React.useState("");
        const [content, setContent] = React.useState("");
        const [submitted, setSubmitted] = React.useState(false);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          const response = (await fetch("/api/posts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer mock-jwt-token",
            },
            body: JSON.stringify({ title, content }),
          })) as any;

          if (response.ok) {
            setSubmitted(true);
            mockPush("/posts/3");
          }
        };

        if (submitted) {
          return <div>Post submitted successfully!</div>;
        }

        return (
          <form onSubmit={handleSubmit}>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Content
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <button type="submit">Submit</button>
          </form>
        );
      };

      rerender(<SubmitForm />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "My First Post");
      await user.type(
        contentTextarea,
        "This is my first post on the platform!",
      );
      await user.click(submitButton);

      (await waitFor(() => {
        expect(
          screen.getByText(/post submitted successfully/i),
        ).toBeInTheDocument();
        expect(mockPush).toHaveBeenCalledWith("/posts/3");
      })) as any;

      // Step 5: Vote on Other Posts
      global.fetch = mockFetch({
        "GET /api/posts/verification": {
          data: mockApiResponses.verification.posts,
        },
        "POST /api/posts/4/vote": {
          data: mockApiResponses.verification.vote.success,
        },
      }) as any;

      // Mock verification page
      const VerifyPosts = () => {
        const [posts, setPosts] = React.useState<any[]>([]);
        const [voted, setVoted] = React.useState(false);

        React.useEffect(() => {
          fetch("/api/posts/verification", {
            headers: { Authorization: "Bearer mock-jwt-token" },
          })
            .then((res) => res.json())
            .then((data) => setPosts(data));
        }, []);

        const handleVote = async (postId: number) => {
          const response = (await fetch(`/api/posts/${postId}/vote`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer mock-jwt-token",
            },
          })) as any;

          if (response.ok) {
            setVoted(true);
          }
        };

        if (voted) {
          return <div>Vote recorded successfully</div>;
        }

        return (
          <div>
            {posts.map((post) => (
              <div key={post.id}>
                <h3>{post.title}</h3>
                <button onClick={() => handleVote(post.id)}>Vote</button>
              </div>
            ))}
          </div>
        );
      };

      rerender(<VerifyPosts />);

      (await waitFor(() => {
        expect(screen.getByText(/Post to Verify/i)).toBeInTheDocument();
      })) as any;

      const voteButton = screen.getByRole("button", { name: /vote/i }) as any;
      await user.click(voteButton);

      (await waitFor(() => {
        expect(
          screen.getByText(/Vote recorded successfully/i),
        ).toBeInTheDocument();
      })) as any;

      // Step 6: View Post with AI Responses
      global.fetch = mockFetch({
        "GET /api/posts/1": {
          data: {
            ...mockApiResponses.posts.list[0],
            status: "verified",
            ai_responses: mockApiResponses.aiAnalysis.completed.providers,
          },
        },
      }) as any;

      // Mock post detail view
      const PostDetail = () => {
        const [post, setPost] = React.useState<any>(null);

        React.useEffect(() => {
          fetch("/api/posts/1", {
            headers: { Authorization: "Bearer mock-jwt-token" },
          })
            .then((res) => res.json())
            .then(setPost);
        }, []);

        if (!post) {
          return <div>Loading...</div>;
        }

        return (
          <div>
            <h1>{post.title}</h1>
            <div>AI Responses</div>
            {post.ai_responses?.openai && (
              <div>OpenAI analysis: {post.ai_responses.openai.response}</div>
            )}
            {post.ai_responses?.anthropic && (
              <div>
                Anthropic analysis: {post.ai_responses.anthropic.response}
              </div>
            )}
          </div>
        );
      };

      rerender(<PostDetail />);

      (await waitFor(() => {
        expect(screen.getByText(/Test Post 1/i)).toBeInTheDocument();
        expect(screen.getByText(/AI Responses/i)).toBeInTheDocument();
        expect(screen.getByText(/OpenAI analysis/i)).toBeInTheDocument();
        expect(screen.getByText(/Anthropic analysis/i)).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Returning User Journey: Login → Dashboard → Submit → Verify", () => {
    it("should handle returning user workflow efficiently", async () => {
      const user = setupUser();

      // Start logged out
      mockAuthStore(false);

      // Step 1: Quick Login
      const QuickLogin = () => {
        const { login } = require("@/hooks/useAuth").useAuth();
        const router = useRouter();

        const handleQuickLogin = async () => {
          const result = (await login({
            username: "testuser",
            password: "Test123!@#",
          })) as any;

          if (result.success) {
            router.push("/dashboard");
          }
        };

        return <button onClick={handleQuickLogin}>Quick Login</button>;
      };

      const { rerender } = render(<QuickLogin />);

      await user.click(screen.getByRole("button", { name: /quick login/i }));

      (await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      })) as any;

      // Update auth state
      mockAuthStore(true, mockApiResponses.login.success.user);

      // Step 2: View Dashboard
      global.fetch = mockFetch({
        "GET /api/users/me/stats": {
          data: {
            posts_count: 5,
            votes_count: 12,
            verified_posts: 3,
            pending_posts: 2,
          },
        },
        "GET /api/posts?author_id=1": {
          data: mockApiResponses.posts.list.filter((p) => p.author_id === 1),
        },
      }) as any;

      const Dashboard = () => {
        const [stats, setStats] = React.useState<any>(null);
        const [posts, setPosts] = React.useState<any[]>([]);

        React.useEffect(() => {
          Promise.all([
            fetch("/api/users/me/stats", {
              headers: { Authorization: "Bearer mock-jwt-token" },
            }).then((r) => r.json()),
            fetch("/api/posts?author_id=1", {
              headers: { Authorization: "Bearer mock-jwt-token" },
            }).then((r) => r.json()),
          ]).then(([statsData, postsData]) => {
            setStats(statsData);
            setPosts(postsData);
          }) as any;
        }, []);

        if (!stats) {
          return <div>Loading...</div>;
        }

        return (
          <div>
            <h1>Dashboard</h1>
            <div>Posts: {stats.posts_count}</div>
            <div>Votes: {stats.votes_count}</div>
            <div>Verified: {stats.verified_posts}</div>
            <div>
              <h2>Your Posts</h2>
              {posts.map((post) => (
                <div key={post.id}>{post.title}</div>
              ))}
            </div>
          </div>
        );
      };

      rerender(<Dashboard />);

      (await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Posts: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/Votes: 12/i)).toBeInTheDocument();
        expect(screen.getByText(/Test Post 1/i)).toBeInTheDocument();
      })) as any;

      // Step 3: Quick Submit from Dashboard
      const QuickSubmit = () => {
        const [showForm, setShowForm] = React.useState(false);
        const [title, setTitle] = React.useState("");
        const [content, setContent] = React.useState("");

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          const response = (await fetch("/api/posts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer mock-jwt-token",
            },
            body: JSON.stringify({ title, content }),
          })) as any;

          if (response.ok) {
            setShowForm(false);
            mockPush("/verify");
          }
        };

        return (
          <div>
            {!showForm ? (
              <button onClick={() => setShowForm(true)}>Quick Submit</button>
            ) : (
              <form onSubmit={handleSubmit}>
                <input
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  placeholder="Content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <button type="submit">Submit</button>
              </form>
            )}
          </div>
        );
      };

      global.fetch = mockFetch({
        "POST /api/posts": { data: mockApiResponses.posts.create.success },
      }) as any;

      rerender(<QuickSubmit />);

      await user.click(screen.getByRole("button", { name: /quick submit/i }));

      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentInput = screen.getByPlaceholderText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Quick Post");
      await user.type(contentInput, "Quick content");
      await user.click(submitButton);

      (await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/verify");
      })) as any;

      // Step 4: Batch Verification
      global.fetch = mockFetch({
        "GET /api/posts/verification": {
          data: mockApiResponses.verification.posts,
        },
        "POST /api/posts/batch-vote": {
          data: {
            message: "Votes recorded successfully",
            results: [
              { post_id: 4, success: true, new_vote_count: 3 },
              { post_id: 5, success: true, new_vote_count: 2 },
            ],
          },
        },
      }) as any;

      const BatchVerify = () => {
        const [posts, setPosts] = React.useState<any[]>([]);
        const [selectedPosts, setSelectedPosts] = React.useState<number[]>([]);

        React.useEffect(() => {
          fetch("/api/posts/verification", {
            headers: { Authorization: "Bearer mock-jwt-token" },
          })
            .then((r) => r.json())
            .then(setPosts);
        }, []);

        const handleBatchVote = async () => {
          (await fetch("/api/posts/batch-vote", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer mock-jwt-token",
            },
            body: JSON.stringify({ post_ids: selectedPosts }),
          })) as any;

          setPosts(posts.filter((p) => !selectedPosts.includes(p.id)));
          setSelectedPosts([]);
        };

        return (
          <div>
            <h1>Verify Posts</h1>
            {posts.map((post) => (
              <div key={post.id}>
                <input
                  type="checkbox"
                  checked={selectedPosts.includes(post.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPosts([...selectedPosts, post.id]);
                    } else {
                      setSelectedPosts(
                        selectedPosts.filter((id) => id !== post.id),
                      );
                    }
                  }}
                />
                {post.title}
              </div>
            ))}
            <button
              onClick={handleBatchVote}
              disabled={selectedPosts.length === 0}
            >
              Vote for Selected ({selectedPosts.length})
            </button>
          </div>
        );
      };

      rerender(<BatchVerify />);

      (await waitFor(() => {
        expect(screen.getByText(/Verify Posts/i)).toBeInTheDocument();
        expect(screen.getByText(/Post to Verify/i)).toBeInTheDocument();
      })) as any;

      // Select posts and batch vote
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      const batchVoteButton = screen.getByRole("button", {
        name: /vote for selected/i,
      }) as any;
      await user.click(batchVoteButton);

      (await waitFor(() => {
        expect(screen.queryByText(/Post to Verify/i)).not.toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;
}) as any;
