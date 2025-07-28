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
import SubmitPage from "@/app/(protected)/submit/page";

const mockPush = jest.fn();

// Mock is already set up in jest.setup.js, we just need to access it
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/submit",
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/submit",
  useParams: () => ({}),
}));

// Mock hooks
jest.mock("@/hooks/usePosts", () => ({
  useCreatePost: () => ({
    createPost: jest.fn().mockResolvedValue({ id: 3 }),
  }),
}));

jest.mock("@/lib/hooks/useDraftPost", () => ({
  useDraftPost: () => ({
    draft: null,
    saveDraft: jest.fn(),
    clearDraft: jest.fn(),
    lastSaved: null,
    isLoading: false,
    error: null,
  }),
}));

describe("Post Creation Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    // Mock authenticated user with verified email
    mockAuthStore(true, {
      ...mockApiResponses.login.success.user,
      is_verified: true,
    }) as any;

    // Mock localStorage for drafts
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    }) as any;
  }) as any;

  describe("Draft Management", () => {
    it("should save draft automatically while typing", async () => {
      const user = setupUser();
      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);

      // Type in title
      await user.type(titleInput, "My Draft Post");

      // Wait for debounced save
      await waitFor(
        () => {
          expect(window.localStorage.setItem).toHaveBeenCalledWith(
            "post-draft",
            expect.stringContaining("My Draft Post"),
          );
        },
        { timeout: 1500 },
      );

      // Type in content
      await user.type(contentTextarea, "This is my draft content");

      // Wait for another save
      await waitFor(
        () => {
          const savedDraft = JSON.parse(
            (window.localStorage.setItem as jest.Mock).mock.calls[
              (window.localStorage.setItem as jest.Mock).mock.calls.length - 1
            ][1],
          );
          expect(savedDraft.title).toBe("My Draft Post");
          expect(savedDraft.content).toBe("This is my draft content");
        },
        { timeout: 1500 },
      );
    }) as any;

    it("should restore draft on component mount", async () => {
      const savedDraft = {
        title: "Restored Draft",
        content: "Restored content from previous session",
        savedAt: new Date().toISOString(),
      };

      window.localStorage.getItem = jest
        .fn()
        .mockReturnValue(JSON.stringify(savedDraft));

      render(<SubmitPage />);

      (await waitFor(() => {
        expect(screen.getByDisplayValue("Restored Draft")).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Restored content from previous session"),
        ).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should clear draft after successful submission", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "POST /api/posts": { data: mockApiResponses.posts.create.success },
      }) as any;

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "New Post");
      await user.type(contentTextarea, "New post content");
      await user.click(submitButton);

      (await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith(
          "post-draft",
        );
      })) as any;
    }) as any;
  }) as any;

  describe("Submission Flow", () => {
    it("should submit post and redirect on success", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "POST /api/posts": { data: mockApiResponses.posts.create.success },
      }) as any;

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "New Post");
      await user.type(contentTextarea, "New post content");
      await user.click(submitButton);

      // Verify API call
      (await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer mock-jwt-token",
            }),
            body: JSON.stringify({
              title: "New Post",
              content: "New post content",
            }),
          }),
        );
      })) as any;

      // Verify success message
      expect(
        screen.getByText(/post submitted successfully/i),
      ).toBeInTheDocument();

      // Verify redirect
      (await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/posts/3");
      })) as any;
    }) as any;

    it("should handle moderation rejection", async () => {
      const user = setupUser();
      global.fetch = mockFetch({
        "POST /api/posts": {
          error: mockApiResponses.posts.create.moderation_failure,
          status: 400,
        },
      }) as any;

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Spam Post");
      await user.type(contentTextarea, "Buy cheap products now!");
      await user.click(submitButton);

      // Verify error message
      (await waitFor(() => {
        expect(
          screen.getByText(/content violates community guidelines/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/spam/i)).toBeInTheDocument();
        expect(screen.getByText(/inappropriate_content/i)).toBeInTheDocument();
      })) as any;

      // Verify no redirect
      expect(mockPush).not.toHaveBeenCalled();
    }) as any;

    it("should validate required fields", async () => {
      const user = setupUser();
      render(<SubmitPage />);

      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      // Try to submit empty form
      await user.click(submitButton);

      // Check for validation errors
      (await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/content is required/i)).toBeInTheDocument();
      })) as any;

      // Verify no API call
      expect(global.fetch).not.toHaveBeenCalled();
    }) as any;

    it("should enforce character limits", async () => {
      const user = setupUser();
      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);

      // Type very long title (assuming 200 char limit)
      const longTitle = "a".repeat(201);
      await user.type(titleInput, longTitle);

      // Type very long content (assuming 5000 char limit)
      const longContent = "b".repeat(5001);
      await user.type(contentTextarea, longContent);

      // Check for limit warnings
      (await waitFor(() => {
        expect(
          screen.getByText(/title must be 200 characters or less/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/content must be 5000 characters or less/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;

    it("should show loading state during submission", async () => {
      const user = setupUser();

      // Delay the response to see loading state
      global.fetch = jest.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => mockApiResponses.posts.create.success,
                } as any),
              1000,
            ),
          ),
      );

      render(<SubmitPage />);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "New Post");
      await user.type(contentTextarea, "New post content");
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(
        () => {
          expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    }) as any;
  }) as any;

  describe("File Upload", () => {
    it("should handle image upload with post", async () => {
      const user = setupUser();
      const file = new File(["image content"], "test.jpg", {
        type: "image/jpeg",
      }) as any;

      global.fetch = mockFetch({
        "POST /api/upload": {
          data: { url: "https://example.com/uploaded.jpg" },
        },
        "POST /api/posts": { data: mockApiResponses.posts.create.success },
      }) as any;

      render(<SubmitPage />);

      const fileInput = screen.getByLabelText(/image/i);
      await user.upload(fileInput, file);

      // Verify upload preview
      (await waitFor(() => {
        expect(screen.getByAltText(/preview/i)).toBeInTheDocument();
      })) as any;

      // Submit post with image
      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);
      const submitButton = screen.getByRole("button", {
        name: /submit/i,
      }) as any;

      await user.type(titleInput, "Post with Image");
      await user.type(contentTextarea, "Content with image");
      await user.click(submitButton);

      // Verify both API calls
      (await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/upload"),
          expect.any(Object),
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/posts"),
          expect.objectContaining({
            body: expect.stringContaining("https://example.com/uploaded.jpg"),
          }),
        );
      })) as any;
    }) as any;

    it("should validate file size and type", async () => {
      const user = setupUser();
      const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      }) as any;
      const invalidFile = new File(["content"], "file.txt", {
        type: "text/plain",
      }) as any;

      render(<SubmitPage />);

      const fileInput = screen.getByLabelText(/image/i);

      // Try large file
      await user.upload(fileInput, largeFile);
      (await waitFor(() => {
        expect(
          screen.getByText(/file size must be less than 10MB/i),
        ).toBeInTheDocument();
      })) as any;

      // Try invalid type
      await user.upload(fileInput, invalidFile);
      (await waitFor(() => {
        expect(
          screen.getByText(/only image files are allowed/i),
        ).toBeInTheDocument();
      })) as any;
    }) as any;
  }) as any;
}) as any;
