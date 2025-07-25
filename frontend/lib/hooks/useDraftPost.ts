import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { logError } from "@/lib/logger";

interface DraftPost {
  title: string;
  content: string;
  source_url: string;
  savedAt: number;
}

interface UseDraftPostReturn {
  draft: DraftPost | null;
  saveDraft: (data: Partial<DraftPost>) => void;
  clearDraft: () => void;
  lastSaved: Date | null;
  isLoading: boolean;
  error: string | null;
}

const DRAFT_KEY = "post_draft";
const SAVE_DELAY = 1000; // 1 second debounce
const MAX_DRAFT_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useDraftPost(): UseDraftPostReturn {
  const [draft, setDraft] = useState<DraftPost | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const user = useAuthStore((state) => state.user);

  // Check if localStorage is available (memoized)
  const isStorageAvailable = useRef<boolean | null>(null);

  const checkStorageAvailable = useCallback(() => {
    if (isStorageAvailable.current !== null) {
      return isStorageAvailable.current;
    }

    try {
      const testKey = "__localStorage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      isStorageAvailable.current = true;
      return true;
    } catch {
      isStorageAvailable.current = false;
      return false;
    }
  }, []);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    if (!checkStorageAvailable()) {
      setError("Local storage is not available");
      setIsLoading(false);
      return;
    }

    try {
      const key = user ? `${DRAFT_KEY}_${user.id}` : DRAFT_KEY;
      const savedData = localStorage.getItem(key);

      if (savedData) {
        const parsed = JSON.parse(savedData) as DraftPost;

        // Check if draft is too old
        if (Date.now() - parsed.savedAt > MAX_DRAFT_AGE) {
          localStorage.removeItem(key);
          setDraft(null);
        } else {
          setDraft(parsed);
          setLastSaved(new Date(parsed.savedAt));
        }
      }
    } catch (err) {
      logError("Failed to load draft:", err);
      setError("Failed to load saved draft");
    } finally {
      setIsLoading(false);
    }
  }, [user, checkStorageAvailable]);

  // Save draft to localStorage with debouncing
  const saveDraft = useCallback(
    (data: Partial<DraftPost>) => {
      if (!checkStorageAvailable()) {
        return;
      }

      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for debounced save
      saveTimeoutRef.current = setTimeout(() => {
        try {
          const key = user ? `${DRAFT_KEY}_${user.id}` : DRAFT_KEY;
          const currentDraft = draft || {
            title: "",
            content: "",
            source_url: "",
            savedAt: 0,
          };
          const updatedDraft: DraftPost = {
            ...currentDraft,
            ...data,
            savedAt: Date.now(),
          };

          // Only save if there's actual content
          if (
            updatedDraft.title ||
            updatedDraft.content ||
            updatedDraft.source_url
          ) {
            try {
              localStorage.setItem(key, JSON.stringify(updatedDraft));
              setDraft(updatedDraft);
              setLastSaved(new Date(updatedDraft.savedAt));
              setError(null);
            } catch (err) {
              // Handle quota exceeded error
              if (
                err instanceof DOMException &&
                err.name === "QuotaExceededError"
              ) {
                setError("Storage quota exceeded. Please clear some space.");
                logError("LocalStorage quota exceeded:", err);
              } else {
                throw err;
              }
            }
          }
        } catch (err) {
          logError("Failed to save draft:", err);
          setError("Failed to save draft");
        }
      }, SAVE_DELAY);
    },
    [draft, user, checkStorageAvailable],
  );

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (!checkStorageAvailable()) {
      return;
    }

    try {
      const key = user ? `${DRAFT_KEY}_${user.id}` : DRAFT_KEY;
      localStorage.removeItem(key);
      setDraft(null);
      setLastSaved(null);
      setError(null);

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    } catch (err) {
      logError("Failed to clear draft:", err);
      setError("Failed to clear draft");
    }
  }, [user, checkStorageAvailable]);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Clear draft on logout
  useEffect(() => {
    if (!user) {
      // User logged out, clear any anonymous draft
      const anonymousKey = DRAFT_KEY;
      try {
        localStorage.removeItem(anonymousKey);
      } catch (err) {
        logError("Failed to clear anonymous draft on logout:", err);
      }
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    draft,
    saveDraft,
    clearDraft,
    lastSaved,
    isLoading,
    error,
  };
}
