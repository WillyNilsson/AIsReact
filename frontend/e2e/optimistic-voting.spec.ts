import { test, expect } from "@playwright/test";

test.describe("Optimistic Voting", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          username: "testuser",
          email: "test@example.com",
          role: "user",
          is_active: true,
          is_verified: true,
        }),
      });
    });

    await page.route("**/api/verification/queue*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            content: "Test post for verification",
            source_url: "https://example.com/article",
            status: "pending_verification",
            verification_score: 3,
            user_vote: null,
            created_at: "2024-01-01T00:00:00Z",
            user: {
              id: 2,
              username: "author",
              email: "author@example.com",
              role: "user",
              is_active: true,
              created_at: "2024-01-01T00:00:00Z",
            },
            ai_response_count: 0,
          },
        ]),
      });
    });
  });

  test("should update UI optimistically when voting", async ({ page }) => {
    // Navigate to verification page
    await page.goto("/verify");

    // Wait for post to load
    await expect(page.getByText("Test post for verification")).toBeVisible();
    await expect(page.getByText("Current Verification Score: 3")).toBeVisible();

    // Mock the vote API call
    let voteRequested = false;
    await page.route("**/api/posts/1/verify/", async (route) => {
      voteRequested = true;

      // Simulate a delay to see optimistic update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Click verify button
    await page.getByRole("button", { name: /verify as accurate/i }).click();

    // UI should update immediately (optimistically)
    // The button should be disabled while voting
    await expect(
      page.getByRole("button", { name: /verify as accurate/i }),
    ).toBeDisabled();

    // Wait for API call to complete
    await page.waitForTimeout(1500);

    // Verify API was called
    expect(voteRequested).toBe(true);
  });

  test("should rollback on API failure", async ({ page }) => {
    // Navigate to verification page
    await page.goto("/verify");

    // Wait for post to load
    await expect(page.getByText("Test post for verification")).toBeVisible();

    // Mock the vote API call to fail
    await page.route("**/api/posts/1/verify/", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "You have already voted on this post" }),
      });
    });

    // Click verify button
    await page.getByRole("button", { name: /verify as accurate/i }).click();

    // Wait for error handling
    await page.waitForTimeout(500);

    // Error toast should appear
    await expect(page.getByText(/vote submission failed/i)).toBeVisible();

    // Button should be enabled again after rollback
    await expect(
      page.getByRole("button", { name: /verify as accurate/i }),
    ).toBeEnabled();
  });

  test("should handle concurrent votes correctly", async ({ page }) => {
    // Mock multiple posts
    await page.route("**/api/verification/queue*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            content: "First post",
            source_url: "https://example.com/1",
            status: "pending_verification",
            verification_score: 2,
            user_vote: null,
            created_at: "2024-01-01T00:00:00Z",
            user: { id: 2, username: "author1" },
          },
          {
            id: 2,
            content: "Second post",
            source_url: "https://example.com/2",
            status: "pending_verification",
            verification_score: 4,
            user_vote: null,
            created_at: "2024-01-01T00:00:00Z",
            user: { id: 3, username: "author2" },
          },
        ]),
      });
    });

    await page.goto("/verify");

    // Mock vote endpoints with different delays
    const voteCallbacks: (() => void)[] = [];

    await page.route("**/api/posts/1/verify/", async (route) => {
      await new Promise((resolve) => {
        voteCallbacks[0] = resolve as () => void;
      });
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/posts/2/verify/", async (route) => {
      await new Promise((resolve) => {
        voteCallbacks[1] = resolve as () => void;
      });
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Vote on both posts quickly
    const firstVoteButton = page
      .getByRole("button", { name: /verify as accurate/i })
      .first();
    const secondVoteButton = page
      .getByRole("button", { name: /verify as accurate/i })
      .nth(1);

    await firstVoteButton.click();
    await secondVoteButton.click();

    // Both should be disabled
    await expect(firstVoteButton).toBeDisabled();
    await expect(secondVoteButton).toBeDisabled();

    // Complete votes in reverse order to test race condition handling
    voteCallbacks[1]?.(); // Complete second vote first
    await page.waitForTimeout(100);
    voteCallbacks[0]?.(); // Then complete first vote

    // Wait for both to complete
    await page.waitForTimeout(500);

    // Both votes should have succeeded
    await expect(page.getByText(/vote submitted/i)).toBeVisible();
  });
});
