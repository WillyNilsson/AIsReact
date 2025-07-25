import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubmitPage from "../page";
import { useCreatePost } from "@/hooks/useCreatePost";
import { useDraftPost } from "@/lib/hooks/useDraftPost";
import { useAuthStore } from "@/store/authStore";

// Mock dependencies
jest.mock("next/navigation");
jest.mock("@/hooks/useCreatePost");
jest.mock("@/lib/hooks/useDraftPost");
jest.mock("@/store/authStore");
jest.mock("@/components/auth/email-verification-guard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock MarkdownEditor to avoid complex setup
jest.mock("@/components/ui/markdown-editor-rich", () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid="markdown-editor"
    />
  ),
}));

describe("SubmitPage File Upload Validation", () => {
  const mockCreatePost = jest.fn();
  const mockSaveDraft = jest.fn();
  const mockClearDraft = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");

    (useCreatePost as jest.Mock).mockReturnValue({
      createPost: mockCreatePost,
    });
    (useDraftPost as jest.Mock).mockReturnValue({
      draft: null,
      saveDraft: mockSaveDraft,
      clearDraft: mockClearDraft,
      lastSaved: null,
      isLoading: false,
      error: null,
    });
    (useAuthStore as jest.Mock).mockReturnValue({ accessToken: "test-token" });
    (useAuthStore as unknown as { getState: jest.Mock }).getState = jest
      .fn()
      .mockReturnValue({ accessToken: "test-token" });
  });

  describe("File Size Validation", () => {
    it("should show error for files over 10MB", async () => {
      render(<SubmitPage />);

      const file = new File([""], "large-image.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 15 * 1024 * 1024 }); // 15MB

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should show error with precise file size
      await waitFor(() => {
        expect(
          screen.getByText(/File size 15\.00MB exceeds size limit/i),
        ).toBeInTheDocument();
      });

      // Should not show preview
      expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    });

    it("should accept files exactly at 10MB", async () => {
      render(<SubmitPage />);

      const file = new File([""], "exact-10mb.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // Exactly 10MB

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds size limit/i),
        ).not.toBeInTheDocument();
      });

      // Should show preview
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });

    it("should accept files under 10MB", async () => {
      render(<SubmitPage />);

      const file = new File([""], "small.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 }); // 2MB

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds size limit/i),
        ).not.toBeInTheDocument();
      });

      // Should show preview
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });

    it("should show decimal precision for file sizes", async () => {
      render(<SubmitPage />);

      const file = new File([""], "precise.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 12.345 * 1024 * 1024 }); // 12.345MB

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should show error with 2 decimal places
      await waitFor(() => {
        expect(
          screen.getByText(/File size 12\.35MB exceeds size limit/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("File Type Validation", () => {
    it("should reject non-image files", async () => {
      render(<SubmitPage />);

      const file = new File([""], "document.pdf", { type: "application/pdf" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      const input = document.getElementById("image-upload") as HTMLInputElement;
      // Remove accept attribute to allow uploading any file type in test
      input.removeAttribute("accept");

      await userEvent.upload(input, file);

      // Should show type error
      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid file type\. Only JPEG, PNG, GIF, and WebP images are allowed/i,
          ),
        ).toBeInTheDocument();
      });

      // Should not show preview
      expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    });

    it.each([
      ["image/jpeg", "photo.jpg"],
      ["image/jpg", "photo2.jpg"], // Test both jpeg and jpg
      ["image/png", "image.png"],
      ["image/gif", "animation.gif"],
      ["image/webp", "modern.webp"],
    ])("should accept %s files", async (mimeType, fileName) => {
      render(<SubmitPage />);

      const file = new File([""], fileName, { type: mimeType });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/Invalid file type/i),
        ).not.toBeInTheDocument();
      });

      // Should show preview
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });
  });

  describe("Error Clearing", () => {
    it("should clear file errors when selecting a valid file", async () => {
      render(<SubmitPage />);

      const input = document.getElementById("image-upload") as HTMLInputElement;

      // First, upload an oversized file
      const largeFile = new File([""], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(largeFile, "size", { value: 20 * 1024 * 1024 }); // 20MB

      await userEvent.upload(input, largeFile);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/exceeds size limit/i)).toBeInTheDocument();
      });

      // Now upload a valid file
      const validFile = new File([""], "valid.jpg", { type: "image/jpeg" });
      Object.defineProperty(validFile, "size", { value: 5 * 1024 * 1024 }); // 5MB

      await userEvent.upload(input, validFile);

      // Error should be cleared
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds size limit/i),
        ).not.toBeInTheDocument();
      });

      // Should show preview
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });

    it("should clear errors when removing file", async () => {
      render(<SubmitPage />);

      const input = document.getElementById("image-upload") as HTMLInputElement;

      // Upload an oversized file
      const largeFile = new File([""], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(largeFile, "size", { value: 20 * 1024 * 1024 }); // 20MB

      await userEvent.upload(input, largeFile);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/exceeds size limit/i)).toBeInTheDocument();
      });

      // Upload a valid file
      const validFile = new File([""], "valid.jpg", { type: "image/jpeg" });
      Object.defineProperty(validFile, "size", { value: 1024 * 1024 }); // 1MB

      await userEvent.upload(input, validFile);

      // Error should be cleared and preview shown
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds size limit/i),
        ).not.toBeInTheDocument();
        expect(screen.getByAltText("Preview")).toBeInTheDocument();
      });

      // Click remove button
      const removeButton = screen.getByText("Remove");
      fireEvent.click(removeButton);

      // Preview should be removed
      await waitFor(() => {
        expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("should not submit form if file validation fails", async () => {
      render(<SubmitPage />);

      // Fill required fields
      await userEvent.type(
        screen.getByLabelText(/title/i),
        "Test Article Title",
      );
      await userEvent.type(
        screen.getByTestId("markdown-editor"),
        "This is test content for the article",
      );
      await userEvent.type(
        screen.getByLabelText(/source url/i),
        "https://example.com/article",
      );

      // Add oversized file
      const file = new File([""], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 }); // 20MB

      const input = document.getElementById("image-upload") as HTMLInputElement;
      await userEvent.upload(input, file);

      // Submit form
      const submitButton = screen.getByText(/submit for analysis/i);
      fireEvent.click(submitButton);

      // Should not call createPost
      await waitFor(() => {
        expect(mockCreatePost).not.toHaveBeenCalled();
      });

      // Error should still be visible
      expect(screen.getByText(/exceeds size limit/i)).toBeInTheDocument();
    });

    it("should handle empty files gracefully", async () => {
      render(<SubmitPage />);

      const file = new File([""], "empty.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 0 }); // 0 bytes

      const input = document.getElementById("image-upload") as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show size error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds size limit/i),
        ).not.toBeInTheDocument();
      });

      // Should show preview (empty file is technically valid)
      expect(screen.getByAltText("Preview")).toBeInTheDocument();
    });
  });
});
