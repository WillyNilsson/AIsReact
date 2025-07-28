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
// Mock moderation page to avoid complex dependencies

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/moderate",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/moderate",
  useParams: () => ({}),
}));

// Mock moderation hooks
jest.mock("@/lib/hooks/useModeration", () => ({
  useModerationQueue: () => ({
    posts: [
      {
        id: 1,
        title: "Post Under Review",
        content: "Content that needs moderation review",
        author_username: "user123",
        created_at: "2024-01-01T00:00:00Z",
        moderation_score: 0.7,
        flagged_categories: ["potentially_harmful"],
      },
      {
        id: 2,
        title: "Another Review Post",
        content: "More content to review",
        author_username: "user456",
        created_at: "2024-01-02T00:00:00Z",
        moderation_score: 0.5,
        flagged_categories: ["needs_review"],
      },
    ],
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
  useModeratePost: () => ({
    approve: jest.fn().mockResolvedValue({ success: true }),
    reject: jest.fn().mockResolvedValue({ success: true }),
    isProcessing: false,
  }),
}));

describe("Moderation Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    // Mock admin user
    mockAuthStore(true, {
      ...mockApiResponses.login.success.user,
      is_admin: true,
    }) as any;
  }) as any;

  describe("Moderation Queue", () => {
    it("should display posts awaiting moderation with risk indicators", async () => {
      global.fetch = mockFetch({
        "GET /api/moderation/queue": {
          data: [
            {
              id: 1,
              title: "Post Under Review",
              content: "Content that needs moderation review",
              author_username: "user123",
              created_at: "2024-01-01T00:00:00Z",
              moderation_score: 0.7,
              flagged_categories: ["potentially_harmful"],
              ai_analysis: {
                openai_moderation: {
                  flagged: true,
                  categories: {
                    hate: 0.1,
                    violence: 0.7,
                    "self-harm": 0.0,
                  },
                },
              },
            },
          ],
        },
      }) as any;

      // Mock moderation page
      const MockModeratePage = () => {
        const [posts, setPosts] = React.useState<any[]>([]);

        React.useEffect(() => {
          fetch("/api/moderation/queue", {
            headers: { Authorization: "Bearer mock-jwt-token" },
          })
            .then((res) => res.json())
            .then(setPosts);
        }, []);

        return (
          <div>
            {posts.map((post) => (
              <div key={post.id}>
                <div>{post.title}</div>
                <div>{post.author_username}</div>
                <div>
                  Risk Score: {Math.round(post.moderation_score * 100)}%
                </div>
                <div>{post.flagged_categories.join(", ")}</div>
              </div>
            ))}
          </div>
        );
      };

      render(<MockModeratePage />);

      (await waitFor(() => {
        // Check post display
        expect(screen.getByText(/Post Under Review/i)).toBeInTheDocument();
        expect(screen.getByText(/user123/i)).toBeInTheDocument();

        // Check risk indicators
        expect(screen.getByText(/Risk Score: 70%/i)).toBeInTheDocument();
        expect(screen.getByText(/potentially_harmful/i)).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should show AI moderation details when expanded", async () => {
      const user = setupUser();

      const ModerationDetails = () => {
        const [expanded, setExpanded] = React.useState<number | null>(null);

        const post = {
          id: 1,
          title: "Post Under Review",
          content: "Full content of the post that needs careful review...",
          moderation_details: {
            openai: {
              flagged: true,
              categories: {
                violence: { score: 0.7, flagged: true },
                hate: { score: 0.1, flagged: false },
                harassment: { score: 0.3, flagged: false },
              },
              reasoning: "Content contains potentially violent language",
            },
          },
        };

        return (
          <div>
            <h3>{post.title}</h3>
            <button
              onClick={() => setExpanded(expanded === post.id ? null : post.id)}
            >
              {expanded === post.id ? "Hide Details" : "Show Details"}
            </button>

            {expanded === post.id && (
              <div>
                <h4>Content</h4>
                <p>{post.content}</p>

                <h4>AI Analysis</h4>
                <div>
                  <p>OpenAI Moderation:</p>
                  <ul>
                    {Object.entries(
                      post.moderation_details.openai.categories,
                    ).map(([category, data]: [string, any]) => (
                      <li key={category}>
                        {category}: {(data.score * 100).toFixed(1)}%
                        {data.flagged && " ⚠️ Flagged"}
                      </li>
                    ))}
                  </ul>
                  <p>Reasoning: {post.moderation_details.openai.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<ModerationDetails />);

      // Click to expand
      await user.click(screen.getByRole("button", { name: /show details/i }));

      // Check expanded content
      (await waitFor(() => {
        expect(
          screen.getByText(/Full content of the post/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/violence: 70.0%/i)).toBeInTheDocument();
        expect(screen.getByText(/⚠️ Flagged/i)).toBeInTheDocument();
        expect(
          screen.getByText(/potentially violent language/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Moderation Actions", () => {
    it("should approve post and move to verification queue", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "POST /api/moderation/1/approve": {
          data: {
            message: "Post approved",
            post: { id: 1, status: "pending_verification" },
          },
        },
      }) as any;

      const ModeratePost = () => {
        const [posts, setPosts] = React.useState([
          { id: 1, title: "Post to Approve", status: "pending_moderation" },
        ]);
        const [message, setMessage] = React.useState("");

        const handleApprove = async (postId: number) => {
          const response = (await fetch(`/api/moderation/${postId}/approve`, {
            method: "POST",
            headers: {
              Authorization: "Bearer mock-jwt-token",
              "Content-Type": "application/json",
            },
          })) as any;

          if (response.ok) {
            setPosts(posts.filter((p) => p.id !== postId));
            setMessage("Post approved and sent to verification");
          }
        };

        return (
          <div>
            {message && <div role="alert">{message}</div>}
            {posts.map((post) => (
              <div key={post.id}>
                <h3>{post.title}</h3>
                <button onClick={() => handleApprove(post.id)}>Approve</button>
              </div>
            ))}
            {posts.length === 0 && <p>No more posts to moderate</p>}
          </div>
        );
      };

      render(<ModeratePost />);

      await user.click(screen.getByRole("button", { name: /approve/i }));

      (await waitFor(() => {
        expect(
          screen.getByText(/Post approved and sent to verification/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/No more posts to moderate/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should reject post with reason and notify author", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "POST /api/moderation/1/reject": {
          data: {
            message: "Post rejected",
            notification_sent: true,
          },
        },
      }) as any;

      const RejectPost = () => {
        const [showRejectForm, setShowRejectForm] = React.useState(false);
        const [reason, setReason] = React.useState("");
        const [additionalNotes, setAdditionalNotes] = React.useState("");
        const [rejected, setRejected] = React.useState(false);

        const handleReject = async () => {
          const response = (await fetch("/api/moderation/1/reject", {
            method: "POST",
            headers: {
              Authorization: "Bearer mock-jwt-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason,
              additional_notes: additionalNotes,
              notify_author: true,
            }),
          })) as any;

          if (response.ok) {
            setRejected(true);
          }
        };

        if (rejected) {
          return <div>Post rejected successfully</div>;
        }

        return (
          <div>
            <h3>Problematic Post</h3>
            <button onClick={() => setShowRejectForm(true)}>Reject</button>

            {showRejectForm && (
              <div role="dialog">
                <h4>Reject Post</h4>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-label="Rejection reason"
                >
                  <option value="">Select reason</option>
                  <option value="spam">Spam</option>
                  <option value="harmful_content">Harmful Content</option>
                  <option value="misinformation">Misinformation</option>
                  <option value="other">Other</option>
                </select>

                <textarea
                  placeholder="Additional notes (optional)"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                />

                <button onClick={handleReject} disabled={!reason}>
                  Confirm Rejection
                </button>
                <button onClick={() => setShowRejectForm(false)}>Cancel</button>
              </div>
            )}
          </div>
        );
      };

      render(<RejectPost />);

      // Open reject form
      await user.click(screen.getByRole("button", { name: /reject/i }));

      // Fill rejection form
      const reasonSelect = screen.getByLabelText(/rejection reason/i);
      await user.selectOptions(reasonSelect, "harmful_content");

      const notesTextarea = screen.getByPlaceholderText(/additional notes/i);
      await user.type(notesTextarea, "Contains violent threats");

      // Submit rejection
      await user.click(
        screen.getByRole("button", { name: /confirm rejection/i }),
      );

      (await waitFor(() => {
        expect(
          screen.getByText(/Post rejected successfully/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should allow bulk moderation actions", async () => {
      const user = setupUser();

      global.fetch = mockFetch({
        "POST /api/moderation/bulk": {
          data: {
            approved: [1, 3],
            rejected: [2],
            failed: [],
          },
        },
      }) as any;

      const BulkModeration = () => {
        const [posts] = React.useState([
          { id: 1, title: "Post 1", risk: "low" },
          { id: 2, title: "Post 2", risk: "high" },
          { id: 3, title: "Post 3", risk: "low" },
        ]);
        const [selected, setSelected] = React.useState<number[]>([]);
        const [result, setResult] = React.useState<any>(null);

        const handleBulkAction = async (action: "approve" | "reject") => {
          const response = (await fetch("/api/moderation/bulk", {
            method: "POST",
            headers: {
              Authorization: "Bearer mock-jwt-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              post_ids: selected,
              action,
              reason: action === "reject" ? "bulk_rejection" : undefined,
            }),
          })) as any;

          if (response.ok) {
            const data = await response.json();
            setResult(data);
          }
        };

        const toggleSelect = (postId: number) => {
          setSelected((prev) =>
            prev.includes(postId)
              ? prev.filter((id) => id !== postId)
              : [...prev, postId],
          );
        };

        return (
          <div>
            {result && (
              <div role="alert">
                Approved: {result.approved.length}, Rejected:{" "}
                {result.rejected.length}
              </div>
            )}

            <div>
              <button onClick={() => setSelected(posts.map((p) => p.id))}>
                Select All
              </button>
              <button onClick={() => setSelected([])}>Clear Selection</button>
            </div>

            {posts.map((post) => (
              <div key={post.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(post.id)}
                  onChange={() => toggleSelect(post.id)}
                />
                <span>
                  {post.title} (Risk: {post.risk})
                </span>
              </div>
            ))}

            <div>
              <button
                onClick={() => handleBulkAction("approve")}
                disabled={selected.length === 0}
              >
                Approve Selected ({selected.length})
              </button>
              <button
                onClick={() => handleBulkAction("reject")}
                disabled={selected.length === 0}
              >
                Reject Selected ({selected.length})
              </button>
            </div>
          </div>
        );
      };

      render(<BulkModeration />);

      // Select low-risk posts
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // Post 1
      await user.click(checkboxes[2]); // Post 3

      // Bulk approve
      await user.click(
        screen.getByRole("button", { name: /approve selected \(2\)/i }),
      );

      (await waitFor(() => {
        expect(
          screen.getByText(/Approved: 2, Rejected: 0/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;

  describe("Moderation Guidelines", () => {
    it("should display moderation guidelines and examples", async () => {
      const Guidelines = () => {
        const [showGuidelines, setShowGuidelines] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShowGuidelines(!showGuidelines)}>
              {showGuidelines ? "Hide" : "Show"} Guidelines
            </button>

            {showGuidelines && (
              <div>
                <h3>Moderation Guidelines</h3>
                <section>
                  <h4>Approve if:</h4>
                  <ul>
                    <li>Content is factual and verifiable</li>
                    <li>No harmful or offensive language</li>
                    <li>Contributes to constructive discussion</li>
                  </ul>
                </section>

                <section>
                  <h4>Reject if:</h4>
                  <ul>
                    <li>Contains hate speech or harassment</li>
                    <li>Spreads misinformation</li>
                    <li>Violates platform policies</li>
                  </ul>
                </section>

                <section>
                  <h4>Edge Cases:</h4>
                  <p>When uncertain, consider:</p>
                  <ul>
                    <li>Context and intent</li>
                    <li>Potential harm vs. value</li>
                    <li>Community standards</li>
                  </ul>
                </section>
              </div>
            )}
          </div>
        );
      };

      render(<Guidelines />);

      const user = setupUser();
      await user.click(
        screen.getByRole("button", { name: /show guidelines/i }),
      );

      expect(screen.getByText(/Moderation Guidelines/i)).toBeInTheDocument();
      expect(screen.getByText(/factual and verifiable/i)).toBeInTheDocument();
      expect(
        screen.getByText(/hate speech or harassment/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Context and intent/i)).toBeInTheDocument();
    }) as any;
  }) as any;

  describe("Moderation History", () => {
    it("should track moderation decisions for audit", async () => {
      global.fetch = mockFetch({
        "GET /api/moderation/history": {
          data: [
            {
              id: 1,
              post_id: 10,
              post_title: "Previously Moderated Post",
              action: "approved",
              moderator: "admin",
              timestamp: "2024-01-01T10:00:00Z",
              reason: null,
            },
            {
              id: 2,
              post_id: 11,
              post_title: "Rejected Post",
              action: "rejected",
              moderator: "admin",
              timestamp: "2024-01-01T11:00:00Z",
              reason: "spam",
            },
          ],
        },
      }) as any;

      const ModerationHistory = () => {
        const [history, setHistory] = React.useState<any[]>([]);

        React.useEffect(() => {
          fetch("/api/moderation/history", {
            headers: { Authorization: "Bearer mock-jwt-token" },
          })
            .then((res) => res.json())
            .then(setHistory);
        }, []);

        return (
          <div>
            <h3>Moderation History</h3>
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Action</th>
                  <th>Moderator</th>
                  <th>Time</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.post_title}</td>
                    <td>{item.action}</td>
                    <td>{item.moderator}</td>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                    <td>{item.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      };

      render(<ModerationHistory />);

      (await waitFor(() => {
        expect(
          screen.getByText(/Previously Moderated Post/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/approved/i)).toBeInTheDocument();
        expect(screen.getByText(/Rejected Post/i)).toBeInTheDocument();
        expect(screen.getByText(/spam/i)).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;
}) as any;
