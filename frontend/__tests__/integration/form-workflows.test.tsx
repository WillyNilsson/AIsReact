import React from "react";
import {
  render,
  screen,
  waitFor,
  setupUser,
  mockFetch,
  mockApiResponses,
} from "@/lib/test-utils";

describe("Form Workflows Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Post Submission Workflow", () => {
    it("should handle draft saving during form input", async () => {
      const user = setupUser();

      // Mock localStorage
      let savedDraft: any = null;
      Storage.prototype.setItem = jest.fn((key, value) => {
        if (key === "post-draft") {
          savedDraft = JSON.parse(value);
        }
      });
      Storage.prototype.getItem = jest.fn((key) => {
        if (key === "post-draft") {
          return savedDraft ? JSON.stringify(savedDraft) : null;
        }
        return null;
      });

      const DraftForm = () => {
        const [title, setTitle] = React.useState("");
        const [content, setContent] = React.useState("");
        const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

        // Auto-save draft
        React.useEffect(() => {
          const timer = setTimeout(() => {
            if (title || content) {
              const draft = {
                title,
                content,
                savedAt: new Date().toISOString(),
              };
              localStorage.setItem("post-draft", JSON.stringify(draft));
              setLastSaved(new Date());
            }
          }, 1000); // Debounce 1 second

          return () => clearTimeout(timer);
        }, [title, content]);

        // Load draft on mount
        React.useEffect(() => {
          const saved = localStorage.getItem("post-draft");
          if (saved) {
            const draft = JSON.parse(saved);
            setTitle(draft.title);
            setContent(draft.content);
          }
        }, []);

        return (
          <form>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              data-testid="title-input"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Content"
              data-testid="content-input"
            />
            {lastSaved && (
              <span data-testid="save-status">
                Draft saved at {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </form>
        );
      };

      const { rerender } = render(<DraftForm />);

      // Type in fields
      const titleInput = screen.getByTestId("title-input");
      const contentInput = screen.getByTestId("content-input");

      await user.type(titleInput, "My Draft Title");
      await user.type(contentInput, "My draft content");

      // Wait for auto-save
      await waitFor(
        () => {
          expect(screen.getByTestId("save-status")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Verify draft was saved
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "post-draft",
        expect.stringContaining("My Draft Title"),
      );

      // Simulate page refresh by remounting
      rerender(<DraftForm />);

      // Should restore draft
      await waitFor(() => {
        expect(screen.getByTestId("title-input")).toHaveValue("My Draft Title");
        expect(screen.getByTestId("content-input")).toHaveValue(
          "My draft content",
        );
      });
    });

    it("should validate and submit form with proper error handling", async () => {
      const user = setupUser();

      // Mock multiple fetch responses
      let fetchCallCount = 0;
      global.fetch = jest.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // First attempt fails
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ detail: "Title too short" }),
          });
        } else {
          // Second attempt succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockApiResponses.posts.create.success,
          });
        }
      }) as any;

      const SubmitForm = () => {
        const [title, setTitle] = React.useState("");
        const [content, setContent] = React.useState("");
        const [errors, setErrors] = React.useState<Record<string, string>>({});
        const [isSubmitting, setIsSubmitting] = React.useState(false);
        const [success, setSuccess] = React.useState(false);

        const validate = () => {
          const newErrors: Record<string, string> = {};

          if (!title) {
            newErrors.title = "Title is required";
          } else if (title.length < 5) {
            newErrors.title = "Title too short";
          }

          if (!content) {
            newErrors.content = "Content is required";
          } else if (content.length < 10) {
            newErrors.content = "Content too short";
          }

          setErrors(newErrors);
          return Object.keys(newErrors).length === 0;
        };

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();

          if (!validate()) {
            return;
          }

          setIsSubmitting(true);
          setErrors({});

          try {
            const response = await fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, content }),
            });

            const data = await response.json();

            if (!response.ok) {
              setErrors({ submit: data.detail });
            } else {
              setSuccess(true);
            }
          } catch (error) {
            setErrors({ submit: "Network error" });
          } finally {
            setIsSubmitting(false);
          }
        };

        if (success) {
          return <div data-testid="success">Post created successfully!</div>;
        }

        return (
          <form onSubmit={handleSubmit}>
            <div>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
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
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (errors.content) {
                    validate();
                  }
                }}
                placeholder="Content"
                aria-invalid={!!errors.content}
              />
              {errors.content && <span role="alert">{errors.content}</span>}
            </div>

            {errors.submit && <div role="alert">{errors.submit}</div>}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        );
      };

      render(<SubmitForm />);

      // Try to submit empty form
      await user.click(screen.getByRole("button", { name: /submit/i }));

      // Should show validation errors
      expect(screen.getByText("Title is required")).toBeInTheDocument();
      expect(screen.getByText("Content is required")).toBeInTheDocument();

      // Fill with short values
      await user.type(screen.getByPlaceholderText("Title"), "Hi");
      await user.type(screen.getByPlaceholderText("Content"), "Short");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      // Should show length errors
      await waitFor(() => {
        expect(screen.getByText("Title too short")).toBeInTheDocument();
        expect(screen.getByText("Content too short")).toBeInTheDocument();
      });

      // Fill with valid values
      await user.clear(screen.getByPlaceholderText("Title"));
      await user.type(screen.getByPlaceholderText("Title"), "Valid Title");
      await user.clear(screen.getByPlaceholderText("Content"));
      await user.type(
        screen.getByPlaceholderText("Content"),
        "Valid content that is long enough",
      );

      // Submit - first attempt will fail (mocked)
      await user.click(screen.getByRole("button", { name: /submit/i }));

      // Should show server error
      await waitFor(() => {
        expect(screen.getByText("Title too short")).toBeInTheDocument();
      });

      // Fix and resubmit - second attempt succeeds
      await user.clear(screen.getByPlaceholderText("Title"));
      await user.type(
        screen.getByPlaceholderText("Title"),
        "Much Longer Valid Title",
      );
      await user.click(screen.getByRole("button", { name: /submit/i }));

      // Should show success
      await waitFor(() => {
        expect(screen.getByTestId("success")).toBeInTheDocument();
      });
    });
  });

  describe("Multi-step Form Workflow", () => {
    it("should handle multi-step registration process", async () => {
      const user = setupUser();

      const MultiStepForm = () => {
        const [step, setStep] = React.useState(1);
        const [formData, setFormData] = React.useState({
          username: "",
          email: "",
          password: "",
          bio: "",
        });

        const handleNext = () => {
          if (step === 1 && formData.username && formData.email) {
            setStep(2);
          } else if (step === 2 && formData.password) {
            setStep(3);
          }
        };

        const handleBack = () => setStep(step - 1);

        const handleSubmit = async () => {
          // Final submission
          console.log("Submitting:", formData);
        };

        return (
          <div>
            <div data-testid="step-indicator">Step {step} of 3</div>

            {step === 1 && (
              <div>
                <h2>Account Details</h2>
                <input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Username"
                />
                <input
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Email"
                />
                <button onClick={handleNext}>Next</button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2>Security</h2>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Password"
                />
                <button onClick={handleBack}>Back</button>
                <button onClick={handleNext}>Next</button>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2>Profile</h2>
                <textarea
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  placeholder="Bio (optional)"
                />
                <button onClick={handleBack}>Back</button>
                <button onClick={handleSubmit}>Complete</button>
              </div>
            )}
          </div>
        );
      };

      render(<MultiStepForm />);

      // Step 1
      expect(screen.getByTestId("step-indicator")).toHaveTextContent(
        "Step 1 of 3",
      );
      expect(screen.getByText("Account Details")).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText("Username"), "newuser");
      await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Step 2
      expect(screen.getByTestId("step-indicator")).toHaveTextContent(
        "Step 2 of 3",
      );
      expect(screen.getByText("Security")).toBeInTheDocument();

      await user.type(
        screen.getByPlaceholderText("Password"),
        "SecurePass123!",
      );
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Step 3
      expect(screen.getByTestId("step-indicator")).toHaveTextContent(
        "Step 3 of 3",
      );
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Can go back
      await user.click(screen.getByRole("button", { name: /back/i }));
      expect(screen.getByTestId("step-indicator")).toHaveTextContent(
        "Step 2 of 3",
      );

      // Return to step 3
      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.type(
        screen.getByPlaceholderText("Bio (optional)"),
        "Hello world!",
      );

      // Complete
      await user.click(screen.getByRole("button", { name: /complete/i }));
    });
  });
});
