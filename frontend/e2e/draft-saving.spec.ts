import { test, expect } from "@playwright/test";

test.describe("Draft Saving for Posts", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/auth/login");
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should save and restore draft", async ({ page }) => {
    // Navigate to submit page
    await page.goto("/submit");

    // Fill in form fields
    await page.fill('input[id="title"]', "My Draft Post Title");
    await page.fill(
      'textarea[data-testid="markdown-editor"]',
      "This is my draft content that should be saved",
    );
    await page.fill(
      'input[id="source_url"]',
      "https://example.com/draft-source",
    );

    // Wait for draft to be saved (debounce time)
    await page.waitForTimeout(1500);

    // Verify draft status appears
    await expect(page.locator("text=Draft saved")).toBeVisible();

    // Navigate away
    await page.goto("/dashboard");

    // Return to submit page
    await page.goto("/submit");

    // Verify draft was restored
    await expect(page.locator('input[id="title"]')).toHaveValue(
      "My Draft Post Title",
    );
    await expect(
      page.locator('textarea[data-testid="markdown-editor"]'),
    ).toHaveValue("This is my draft content that should be saved");
    await expect(page.locator('input[id="source_url"]')).toHaveValue(
      "https://example.com/draft-source",
    );

    // Verify restore notification
    await expect(page.locator("text=Previous draft restored")).toBeVisible();
  });

  test("should clear draft after successful submission", async ({ page }) => {
    await page.goto("/submit");

    // Fill form with draft data
    await page.fill('input[id="title"]', "Post to Submit");
    await page.fill(
      'textarea[data-testid="markdown-editor"]',
      "Content to submit",
    );
    await page.fill('input[id="source_url"]', "https://example.com/submit");

    // Wait for draft save
    await page.waitForTimeout(1500);

    // Mock successful submission
    await page.route("**/api/posts/", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "new-post-123",
          title: "Post to Submit",
          content: "Content to submit",
          source_url: "https://example.com/submit",
          status: "pending_moderation",
        }),
      });
    });

    // Submit form
    await page.click('button:has-text("Submit for Analysis")');

    // Should redirect to post page
    await page.waitForURL("**/posts/new-post-123");

    // Go back to submit page
    await page.goto("/submit");

    // Fields should be empty (no draft)
    await expect(page.locator('input[id="title"]')).toHaveValue("");
    await expect(
      page.locator('textarea[data-testid="markdown-editor"]'),
    ).toHaveValue("");
    await expect(page.locator('input[id="source_url"]')).toHaveValue("");
  });

  test("should clear draft when clear button is clicked", async ({ page }) => {
    await page.goto("/submit");

    // Fill form
    await page.fill('input[id="title"]', "Draft to Clear");
    await page.fill(
      'textarea[data-testid="markdown-editor"]',
      "Content to clear",
    );
    await page.fill('input[id="source_url"]', "https://example.com/clear");

    // Wait for draft save
    await page.waitForTimeout(1500);

    // Click clear draft button
    await page.click('button:has-text("Clear Draft")');

    // Verify fields are cleared
    await expect(page.locator('input[id="title"]')).toHaveValue("");
    await expect(
      page.locator('textarea[data-testid="markdown-editor"]'),
    ).toHaveValue("");
    await expect(page.locator('input[id="source_url"]')).toHaveValue("");

    // Verify draft status is gone
    await expect(page.locator("text=Draft saved")).not.toBeVisible();
  });

  test("should show error when localStorage is full", async ({
    page,
    context,
  }) => {
    await page.goto("/submit");

    // Fill localStorage to simulate quota exceeded
    await context.addInitScript(() => {
      // Fill localStorage with large data
      try {
        const largeData = "x".repeat(5 * 1024 * 1024); // 5MB
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`filler_${i}`, largeData);
        }
      } catch (e) {
        // Expected to fail eventually
      }
    });

    // Try to save draft
    await page.fill('input[id="title"]', "Will fail to save");
    await page.waitForTimeout(1500);

    // Should show storage error
    await expect(
      page.locator("text=/Storage quota exceeded|storage.*full/i"),
    ).toBeVisible();
  });

  test("should preserve draft across browser refresh", async ({ page }) => {
    await page.goto("/submit");

    // Fill form
    await page.fill('input[id="title"]', "Draft Before Refresh");
    await page.fill(
      'textarea[data-testid="markdown-editor"]',
      "Content before refresh",
    );
    await page.fill('input[id="source_url"]', "https://example.com/refresh");

    // Wait for draft save
    await page.waitForTimeout(1500);

    // Refresh page
    await page.reload();

    // Verify draft is restored
    await expect(page.locator('input[id="title"]')).toHaveValue(
      "Draft Before Refresh",
    );
    await expect(
      page.locator('textarea[data-testid="markdown-editor"]'),
    ).toHaveValue("Content before refresh");
    await expect(page.locator('input[id="source_url"]')).toHaveValue(
      "https://example.com/refresh",
    );
  });

  test("should handle old drafts correctly", async ({ page, context }) => {
    // Set an old draft directly in localStorage
    await context.addInitScript(() => {
      const oldDraft = {
        title: "Very Old Draft",
        content: "This draft is too old",
        source_url: "https://example.com/old",
        savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old
      };
      localStorage.setItem("post_draft_user-123", JSON.stringify(oldDraft));
    });

    await page.goto("/submit");

    // Old draft should not be restored
    await expect(page.locator('input[id="title"]')).toHaveValue("");
    await expect(
      page.locator('textarea[data-testid="markdown-editor"]'),
    ).toHaveValue("");
    await expect(page.locator('input[id="source_url"]')).toHaveValue("");
  });
});
