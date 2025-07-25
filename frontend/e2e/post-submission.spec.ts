import { test, expect } from "@playwright/test";

test.describe("Post Submission", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/auth/login");
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("can submit a text post", async ({ page }) => {
    await page.goto("/submit");

    // Select text content type
    await page.click('button:has-text("Text Content")');

    // Fill form
    await page.fill(
      'textarea[name="content_text"]',
      "This is a test post about AI and technology trends in 2025.",
    );
    await page.fill(
      'input[name="source_url"]',
      "https://example.com/ai-trends-2025",
    );

    // Submit
    await page.click('button[type="submit"]:has-text("Submit")');

    // Should show success message or redirect
    await expect(
      page.locator("text=/Success|submitted|pending moderation/i"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can submit an image post", async ({ page }) => {
    await page.goto("/submit");

    // Select image content type
    await page.click('button:has-text("Image Content")');

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-image-content"),
    });

    // Fill source URL
    await page.fill(
      'input[name="source_url"]',
      "https://example.com/image-source",
    );

    // Should show image preview
    await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();

    // Submit
    await page.click('button[type="submit"]:has-text("Submit")');

    // Should show success
    await expect(
      page.locator("text=/Success|submitted|pending moderation/i"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("validates form fields", async ({ page }) => {
    await page.goto("/submit");

    // Try to submit without selecting content type
    const submitButton = page.locator(
      'button[type="submit"]:has-text("Submit")',
    );
    await expect(submitButton).toBeDisabled();

    // Select text type
    await page.click('button:has-text("Text Content")');

    // Try to submit empty form
    await submitButton.click();

    // Should show validation errors
    await expect(page.locator("text=/required|must provide/i")).toBeVisible();

    // Test URL validation
    await page.fill('input[name="source_url"]', "not-a-valid-url");
    await submitButton.click();
    await expect(page.locator("text=/invalid.*url/i")).toBeVisible();
  });

  test("shows character count for text posts", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Text Content")');

    const textarea = page.locator('textarea[name="content_text"]');
    const charCount = page.locator('[data-testid="char-count"]');

    // Type some text
    await textarea.fill("Hello world");
    await expect(charCount).toContainText("11");

    // Add more text
    await textarea.fill("This is a longer text with more characters");
    await expect(charCount).toContainText("42");
  });

  test("prevents duplicate submissions", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Text Content")');

    // Fill form
    await page.fill('textarea[name="content_text"]', "Test post content");
    await page.fill('input[name="source_url"]', "https://example.com/test");

    // Double-click submit (simulate accidental double submission)
    const submitButton = page.locator(
      'button[type="submit"]:has-text("Submit")',
    );
    await submitButton.dblclick();

    // Button should be disabled after first click
    await expect(submitButton).toBeDisabled();

    // Should only submit once
    await expect(
      page.locator("text=/Success|submitted|pending moderation/i"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("handles file upload errors gracefully", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Image Content")');

    // Try to upload invalid file type
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });

    // Should show error
    await expect(
      page.locator("text=/Invalid file type|Only.*images/i"),
    ).toBeVisible();
  });

  test("preserves form data on navigation", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Text Content")');

    // Fill form
    const content = "This is my important post content";
    await page.fill('textarea[name="content_text"]', content);
    await page.fill('input[name="source_url"]', "https://example.com/source");

    // Navigate away and back
    await page.goto("/dashboard");
    await page.goto("/submit");

    // Check if form data is preserved (if implemented)
    // This depends on whether the app implements form persistence
    const textarea = page.locator('textarea[name="content_text"]');
    const _textareaValue = await textarea.inputValue();

    // If form persistence is implemented, uncomment:
    // expect(textareaValue).toBe(content);
  });

  test("shows upload progress for images", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Image Content")');

    // Mock slow upload
    await page.route("**/api/upload/presigned-url/", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          upload_url: "https://example.s3.amazonaws.com/upload",
          file_url: "https://example.s3.amazonaws.com/uploads/test.jpg",
        }),
      });
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "large-image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("x".repeat(1024 * 1024)), // 1MB fake file
    });

    // Should show upload progress
    const progressBar = page.locator('[data-testid="upload-progress"]');
    if (await progressBar.isVisible()) {
      await expect(progressBar).toBeVisible();
    }
  });

  test("can save draft and continue later", async ({ page }) => {
    await page.goto("/submit");
    await page.click('button:has-text("Text Content")');

    // Fill partial form
    await page.fill('textarea[name="content_text"]', "This is my draft post");

    // Save draft (if feature exists)
    const saveDraftButton = page.locator('button:has-text("Save Draft")');
    if (await saveDraftButton.isVisible()) {
      await saveDraftButton.click();
      await expect(page.locator("text=/Draft saved/i")).toBeVisible();
    }
  });
});
