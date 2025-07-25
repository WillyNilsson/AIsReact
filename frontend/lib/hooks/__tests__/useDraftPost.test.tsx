import { renderHook, act, waitFor } from "@testing-library/react";
import { useDraftPost } from "../useDraftPost";
import { useAuthStore } from "@/store/authStore";
import { logError } from "@/lib/logger";

// Mock dependencies
jest.mock("@/store/authStore");
jest.mock("@/lib/logger");

// Simple localStorage mock
const mockStorage: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("useDraftPost", () => {
  const mockUser = { id: "user-123", username: "testuser" };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ user: null }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should initialize with no draft", () => {
    const { result } = renderHook(() => useDraftPost());

    expect(result.current.draft).toBeNull();
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should load existing draft on mount", async () => {
    const existingDraft = {
      title: "Test Title",
      content: "Test Content",
      source_url: "https://example.com",
      savedAt: Date.now(),
    };

    mockStorage["post_draft"] = JSON.stringify(existingDraft);

    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.draft).toEqual(existingDraft);
    expect(result.current.lastSaved).toEqual(new Date(existingDraft.savedAt));
  });

  it("should save draft with debouncing", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCalls = localStorageMock.setItem.mock.calls.length;

    // Save draft multiple times rapidly
    act(() => {
      result.current.saveDraft({ title: "First" });
      result.current.saveDraft({ title: "Second" });
      result.current.saveDraft({ title: "Third" });
    });

    // Should not save immediately
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(initialCalls);

    // Fast forward past debounce delay
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Should save only once with the latest value
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(initialCalls + 1);
    const lastCall =
      localStorageMock.setItem.mock.calls[
        localStorageMock.setItem.mock.calls.length - 1
      ];
    expect(lastCall[0]).toBe("post_draft");
    const savedData = JSON.parse(lastCall[1]);
    expect(savedData.title).toBe("Third");
  });

  it("should save user-specific drafts when authenticated", async () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ user: mockUser }),
    );

    jest.useFakeTimers();
    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.saveDraft({ title: "User Draft" });
    });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "post_draft_user-123",
      expect.stringContaining("User Draft"),
    );
  });

  it("should clear draft", async () => {
    const existingDraft = {
      title: "Test",
      content: "Content",
      source_url: "https://example.com",
      savedAt: Date.now(),
    };

    mockStorage["post_draft"] = JSON.stringify(existingDraft);

    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.lastSaved).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("post_draft");
  });

  it("should handle localStorage unavailable", async () => {
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = jest.fn(() => {
      throw new Error("localStorage not available");
    });

    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Local storage is not available");

    // Restore original mock
    localStorageMock.setItem = originalSetItem;
  });

  it("should handle quota exceeded error", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock quota exceeded after initial checks
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = jest.fn(() => {
      const error = new DOMException("", "QuotaExceededError");
      Object.defineProperty(error, "name", {
        value: "QuotaExceededError",
        writable: false,
        enumerable: true,
        configurable: true,
      });
      throw error;
    });

    act(() => {
      result.current.saveDraft({ title: "Large content" });
    });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(result.current.error).toBe(
      "Storage quota exceeded. Please clear some space.",
    );
    expect(logError).toHaveBeenCalledWith(
      "LocalStorage quota exceeded:",
      expect.any(Error),
    );

    // Restore original mock
    localStorageMock.setItem = originalSetItem;
  });

  it("should remove old drafts", async () => {
    const oldDraft = {
      title: "Old Draft",
      content: "Old Content",
      source_url: "https://example.com",
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old
    };

    mockStorage["post_draft"] = JSON.stringify(oldDraft);

    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.draft).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("post_draft");
  });

  it("should clear anonymous draft on logout", async () => {
    // Start with a user
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ user: mockUser }),
    );

    const { result, rerender } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate logout
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ user: null }),
    );

    rerender();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("post_draft");
  });

  it("should handle corrupted draft data", async () => {
    mockStorage["post_draft"] = "invalid json";

    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.error).toBe("Failed to load saved draft");
    expect(logError).toHaveBeenCalledWith(
      "Failed to load draft:",
      expect.any(Error),
    );
  });

  it("should only save when there is content", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCalls = localStorageMock.setItem.mock.calls.length;

    // Try to save empty draft
    act(() => {
      result.current.saveDraft({ title: "", content: "", source_url: "" });
    });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Should not have saved
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(initialCalls);

    // Save with content
    act(() => {
      result.current.saveDraft({ title: "Has content" });
    });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Should have saved once
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it("should cancel pending saves on clear", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDraftPost());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCalls = localStorageMock.setItem.mock.calls.length;

    // Start a save
    act(() => {
      result.current.saveDraft({ title: "Will be cancelled" });
    });

    // Clear before save completes
    act(() => {
      result.current.clearDraft();
    });

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Save should not have happened
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(initialCalls);
  });
});
