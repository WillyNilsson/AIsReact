import { uploadFile } from "../upload";
import { _testApiClient as apiClient } from "../../api";
import { logError } from "../../logger";

// Mock dependencies
jest.mock("../../api");
jest.mock("../../logger");

describe("Upload API", () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
  const mockLogError = logError as jest.MockedFunction<typeof logError>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    describe("File Size Validation", () => {
      it("should reject files over 10MB with precise size", async () => {
        const file = new File([""], "large.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 15.5 * 1024 * 1024 }); // 15.5MB

        await expect(uploadFile(file)).rejects.toThrow(
          "File size (15.50MB) exceeds the 10MB limit. Please choose a smaller file.",
        );

        // Should not make API call
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });

      it("should accept files exactly at 10MB", async () => {
        const file = new File([""], "exact.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // Exactly 10MB

        // Mock successful API responses
        mockApiClient.get.mockResolvedValue({
          data: {
            url: "https://s3.example.com/upload",
            fields: { key: "test-key" },
            key: "uploads/test-key.jpg",
          },
        });

        // Mock XMLHttpRequest for S3 upload
        const mockXHR = {
          upload: { addEventListener: jest.fn() },
          addEventListener: jest.fn(),
          open: jest.fn(),
          send: jest.fn(),
          status: 204,
        };
        // @ts-expect-error - Mocking XMLHttpRequest for testing
        global.XMLHttpRequest = jest.fn(() => mockXHR) as typeof XMLHttpRequest;

        // Trigger load event immediately
        mockXHR.addEventListener.mockImplementation((event, handler) => {
          if (event === "load") {
            setTimeout(() => handler(), 0);
          }
        });

        const result = await uploadFile(file);

        expect(result).toBe("uploads/test-key.jpg");
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      it("should accept files under 10MB", async () => {
        const file = new File([""], "small.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

        // Mock successful API responses
        mockApiClient.get.mockResolvedValue({
          data: {
            url: "https://s3.example.com/upload",
            fields: { key: "test-key" },
            key: "uploads/test-key.jpg",
          },
        });

        // Mock XMLHttpRequest
        const mockXHR = {
          upload: { addEventListener: jest.fn() },
          addEventListener: jest.fn(),
          open: jest.fn(),
          send: jest.fn(),
          status: 204,
        };
        // @ts-expect-error - Mocking XMLHttpRequest for testing
        global.XMLHttpRequest = jest.fn(() => mockXHR) as typeof XMLHttpRequest;

        mockXHR.addEventListener.mockImplementation((event, handler) => {
          if (event === "load") {
            setTimeout(() => handler(), 0);
          }
        });

        const result = await uploadFile(file);

        expect(result).toBe("uploads/test-key.jpg");
        expect(mockLogError).not.toHaveBeenCalled();
      });

      it("should handle empty files", async () => {
        const file = new File([""], "empty.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 0 }); // 0 bytes

        // Mock successful API responses
        mockApiClient.get.mockResolvedValue({
          data: {
            url: "https://s3.example.com/upload",
            fields: { key: "test-key" },
            key: "uploads/test-key.jpg",
          },
        });

        // Mock XMLHttpRequest
        const mockXHR = {
          upload: { addEventListener: jest.fn() },
          addEventListener: jest.fn(),
          open: jest.fn(),
          send: jest.fn(),
          status: 204,
        };
        // @ts-expect-error - Mocking XMLHttpRequest for testing
        global.XMLHttpRequest = jest.fn(() => mockXHR) as typeof XMLHttpRequest;

        mockXHR.addEventListener.mockImplementation((event, handler) => {
          if (event === "load") {
            setTimeout(() => handler(), 0);
          }
        });

        const result = await uploadFile(file);

        expect(result).toBe("uploads/test-key.jpg");
      });

      it("should show precise decimal values in error messages", async () => {
        const testCases = [
          { size: 10.1, expected: "10.10MB" },
          { size: 15.999, expected: "16.00MB" },
          { size: 100.456, expected: "100.46MB" },
          { size: 10.001, expected: "10.00MB" }, // Should round down
        ];

        for (const { size, expected } of testCases) {
          const file = new File([""], "test.jpg", { type: "image/jpeg" });
          Object.defineProperty(file, "size", { value: size * 1024 * 1024 });

          await expect(uploadFile(file)).rejects.toThrow(
            `File size (${expected}) exceeds the 10MB limit. Please choose a smaller file.`,
          );
        }
      });
    });

    describe("File Type Validation", () => {
      it("should reject invalid file types", async () => {
        const invalidTypes = [
          { type: "application/pdf", name: "document.pdf" },
          { type: "text/plain", name: "text.txt" },
          { type: "video/mp4", name: "video.mp4" },
          { type: "audio/mpeg", name: "audio.mp3" },
        ];

        for (const { type, name } of invalidTypes) {
          const file = new File([""], name, { type });
          Object.defineProperty(file, "size", { value: 1024 }); // 1KB

          await expect(uploadFile(file)).rejects.toThrow(
            "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
          );

          expect(mockApiClient.get).not.toHaveBeenCalled();
        }
      });

      it.each(["image/jpeg", "image/png", "image/gif", "image/webp"])(
        "should accept %s files",
        async (mimeType) => {
          const file = new File([""], "test.jpg", { type: mimeType });
          Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

          // Mock successful API responses
          mockApiClient.get.mockResolvedValue({
            data: {
              url: "https://s3.example.com/upload",
              fields: { key: "test-key" },
              key: "uploads/test-key.jpg",
            },
          });

          // Mock XMLHttpRequest
          const mockXHR = {
            upload: { addEventListener: jest.fn() },
            addEventListener: jest.fn(),
            open: jest.fn(),
            send: jest.fn(),
            status: 204,
          };
          // @ts-expect-error - Mocking XMLHttpRequest for testing
          global.XMLHttpRequest = jest.fn(
            () => mockXHR,
          ) as typeof XMLHttpRequest;

          mockXHR.addEventListener.mockImplementation((event, handler) => {
            if (event === "load") {
              setTimeout(() => handler(), 0);
            }
          });

          const result = await uploadFile(file);

          expect(result).toBe("uploads/test-key.jpg");
        },
      );
    });

    describe("Progress Tracking", () => {
      it("should report upload progress", async () => {
        const file = new File([""], "test.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

        const progressCallback = jest.fn();

        // Mock API response
        mockApiClient.get.mockResolvedValue({
          data: {
            url: "https://s3.example.com/upload",
            fields: { key: "test-key" },
            key: "uploads/test-key.jpg",
          },
        });

        // Mock XMLHttpRequest with progress events
        const mockXHR = {
          upload: { addEventListener: jest.fn() },
          addEventListener: jest.fn(),
          open: jest.fn(),
          send: jest.fn(),
          status: 204,
        };
        // @ts-expect-error - Mocking XMLHttpRequest for testing
        global.XMLHttpRequest = jest.fn(() => mockXHR) as typeof XMLHttpRequest;

        let progressHandler: (event: ProgressEvent) => void;
        mockXHR.upload.addEventListener.mockImplementation((event, handler) => {
          if (event === "progress") {
            progressHandler = handler;
          }
        });

        mockXHR.addEventListener.mockImplementation((event, handler) => {
          if (event === "load") {
            // Simulate progress events
            progressHandler({
              lengthComputable: true,
              loaded: 512000,
              total: 1048576,
            } as ProgressEvent<EventTarget>);
            progressHandler({
              lengthComputable: true,
              loaded: 1048576,
              total: 1048576,
            } as ProgressEvent<EventTarget>);
            setTimeout(() => handler(), 0);
          }
        });

        await uploadFile(file, progressCallback);

        expect(progressCallback).toHaveBeenCalledWith({
          loaded: 512000,
          total: 1048576,
          percentage: 49,
        });

        expect(progressCallback).toHaveBeenCalledWith({
          loaded: 1048576,
          total: 1048576,
          percentage: 100,
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle API errors gracefully", async () => {
        const file = new File([""], "test.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 1024 }); // 1KB

        const apiError = new Error("Network error");
        mockApiClient.get.mockRejectedValue(apiError);

        await expect(uploadFile(file)).rejects.toThrow("Network error");

        expect(mockLogError).toHaveBeenCalledWith("Upload error:", apiError, {
          filename: "test.jpg",
          fileSize: 1024,
        });
      });

      it("should handle S3 upload failures", async () => {
        const file = new File([""], "test.jpg", { type: "image/jpeg" });
        Object.defineProperty(file, "size", { value: 1024 }); // 1KB

        // Mock successful presigned URL fetch
        mockApiClient.get.mockResolvedValue({
          data: {
            url: "https://s3.example.com/upload",
            fields: { key: "test-key" },
            key: "uploads/test-key.jpg",
          },
        });

        // Mock XMLHttpRequest with error
        const mockXHR = {
          upload: { addEventListener: jest.fn() },
          addEventListener: jest.fn(),
          open: jest.fn(),
          send: jest.fn(),
          status: 403,
        };
        // @ts-expect-error - Mocking XMLHttpRequest for testing
        global.XMLHttpRequest = jest.fn(() => mockXHR) as typeof XMLHttpRequest;

        mockXHR.addEventListener.mockImplementation((event, handler) => {
          if (event === "load") {
            setTimeout(() => handler(), 0);
          }
        });

        await expect(uploadFile(file)).rejects.toThrow(
          "Upload failed with status: 403",
        );
      });
    });
  });
});
