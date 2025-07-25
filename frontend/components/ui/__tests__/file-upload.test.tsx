import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUpload } from "../file-upload";
import * as uploadApi from "@/lib/api/upload";

// Mock the upload API
jest.mock("@/lib/api/upload");

describe("FileUpload", () => {
  const mockOnChange = jest.fn();
  const mockUploadFile = uploadApi.uploadFile as jest.MockedFunction<
    typeof uploadApi.uploadFile
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful upload by default
    mockUploadFile.mockResolvedValue("test-s3-key");
  });

  describe("File Size Validation", () => {
    it("should reject files over 10MB", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "large-image.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 }); // 11MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should show error message with actual file size
      await waitFor(() => {
        expect(
          screen.getByText(/File size \(11\.00MB\) exceeds the 10MB limit/i),
        ).toBeInTheDocument();
      });

      // Should not call onChange or uploadFile
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it("should accept files exactly at 10MB", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "exact-size.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // Exactly 10MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds the 10MB limit/i),
        ).not.toBeInTheDocument();
      });

      // Should proceed with upload
      expect(mockUploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    });

    it("should accept files under 10MB", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "small-image.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 }); // 5MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds the 10MB limit/i),
        ).not.toBeInTheDocument();
      });

      // Should proceed with upload
      expect(mockUploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    });

    it("should show precise file size in error message", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "precise-size.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 15.7 * 1024 * 1024 }); // 15.7MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should show error with precise size
      await waitFor(() => {
        expect(
          screen.getByText(/File size \(15\.70MB\) exceeds the 10MB limit/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("File Type Validation", () => {
    it("should reject non-image files", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "document.pdf", { type: "application/pdf" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // Remove accept attribute to allow uploading any file type in test
      input.removeAttribute("accept");

      await userEvent.upload(input, file);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid file type\. Only JPEG, PNG, GIF, and WebP images are allowed/i,
          ),
        ).toBeInTheDocument();
      });

      // Should not call onChange or uploadFile
      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it.each([
      ["image/jpeg", "photo.jpg"],
      ["image/png", "image.png"],
      ["image/gif", "animation.gif"],
      ["image/webp", "modern.webp"],
    ])("should accept %s files", async (mimeType, fileName) => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], fileName, { type: mimeType });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show error
      await waitFor(() => {
        expect(
          screen.queryByText(/Invalid file type/i),
        ).not.toBeInTheDocument();
      });

      // Should proceed with upload
      expect(mockUploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    });
  });

  describe("Drag and Drop", () => {
    it("should validate file size on drop", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const dropZone = screen
        .getByText(/drop your image here/i)
        .closest("div") as HTMLElement;

      const file = new File([""], "large-drop.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 }); // 20MB

      const dataTransfer = {
        files: [file],
        types: ["Files"],
      };

      fireEvent.dragOver(dropZone, { dataTransfer });
      fireEvent.drop(dropZone, { dataTransfer });

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/File size \(20\.00MB\) exceeds the 10MB limit/i),
        ).toBeInTheDocument();
      });

      // Should not proceed with upload
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it("should validate file type on drop", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const dropZone = screen
        .getByText(/drop your image here/i)
        .closest("div") as HTMLElement;

      const file = new File([""], "document.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { value: 1024 }); // 1KB

      const dataTransfer = {
        files: [file],
        types: ["Files"],
      };

      fireEvent.dragOver(dropZone, { dataTransfer });
      fireEvent.drop(dropZone, { dataTransfer });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });

      // Should not proceed with upload
      expect(mockUploadFile).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should clear previous errors when selecting a valid file", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // First, upload an invalid file
      const invalidFile = new File([""], "too-large.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(invalidFile, "size", { value: 15 * 1024 * 1024 }); // 15MB

      await userEvent.upload(input, invalidFile);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10MB limit/i)).toBeInTheDocument();
      });

      // Now upload a valid file
      const validFile = new File([""], "valid.jpg", { type: "image/jpeg" });
      Object.defineProperty(validFile, "size", { value: 1024 * 1024 }); // 1MB

      await userEvent.upload(input, validFile);

      // Error should be cleared
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds the 10MB limit/i),
        ).not.toBeInTheDocument();
      });

      // Should proceed with upload
      expect(mockUploadFile).toHaveBeenCalledWith(
        validFile,
        expect.any(Function),
      );
    });

    it("should handle empty files gracefully", async () => {
      render(<FileUpload onChange={mockOnChange} />);

      const file = new File([""], "empty.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 0 }); // 0 bytes

      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await userEvent.upload(input, file);

      // Should not show size error
      await waitFor(() => {
        expect(
          screen.queryByText(/exceeds the 10MB limit/i),
        ).not.toBeInTheDocument();
      });

      // Should proceed with upload (backend may have additional validation)
      expect(mockUploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    });
  });
});
