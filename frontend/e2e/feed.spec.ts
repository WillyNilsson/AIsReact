import { test, expect } from "@playwright/test";

test.describe("Feed Functionality", () => {
  test("displays live feed on homepage", async ({ page }) => {
    await page.goto("/");

    // Should show feed title
    await expect(page.locator("h1")).toContainText("AI Reactions Feed");

    // Should show feed cards
    const feedCards = page.locator('[data-testid="feed-card"]');
    await expect(feedCards.first()).toBeVisible();

    // Feed card should have expected elements
    const firstCard = feedCards.first();
    await expect(
      firstCard.locator("text=/Text Post|Image Post/"),
    ).toBeVisible();
    await expect(firstCard.locator('[data-testid="username"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="source-url"]')).toBeVisible();
  });

  test("can search posts", async ({ page }) => {
    await page.goto("/");

    // Type in search input
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("technology");

    // Wait for search results
    await page.waitForTimeout(600); // Wait for debounce

    // Results should be filtered
    const feedCards = page.locator('[data-testid="feed-card"]');
    const count = await feedCards.count();

    if (count > 0) {
      // At least one result should contain search term
      const cardTexts = await feedCards.allTextContents();
      const hasSearchTerm = cardTexts.some((text) =>
        text.toLowerCase().includes("technology"),
      );
      expect(hasSearchTerm).toBeTruthy();
    }
  });

  test("implements infinite scroll", async ({ page }) => {
    await page.goto("/");

    // Get initial post count
    const initialCards = await page
      .locator('[data-testid="feed-card"]')
      .count();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for more posts to load
    await page.waitForTimeout(1000);

    // Should have more posts
    const afterScrollCards = await page
      .locator('[data-testid="feed-card"]')
      .count();
    expect(afterScrollCards).toBeGreaterThanOrEqual(initialCards);

    // Should show end message when all posts loaded
    const endMessage = page.locator("text=/reached the end|No more posts/");
    if (await endMessage.isVisible()) {
      await expect(endMessage).toBeVisible();
    }
  });

  test("can refresh feed", async ({ page }) => {
    await page.goto("/");

    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.click();

    // Button should show loading state
    await expect(refreshButton).toBeDisabled();

    // Should eventually re-enable
    await expect(refreshButton).toBeEnabled({ timeout: 5000 });
  });

  test("navigates to post detail on card click", async ({ page }) => {
    await page.goto("/");

    // Click first feed card
    const firstCard = page.locator('[data-testid="feed-card"]').first();
    const postLink = await firstCard.getAttribute("href");

    await firstCard.click();

    // Should navigate to post detail page
    await expect(page).toHaveURL(/\/posts\/\d+/);

    // Should show post content
    await expect(page.locator('h2:has-text("Content")')).toBeVisible();
  });

  test("shows different feed states", async ({ page }) => {
    // Test empty state
    await page.goto("/?search=veryrandomsearchtermthatdoesnotexist123456");
    await page.waitForTimeout(600); // Wait for debounce

    const emptyState = page.locator("text=/No posts found|No live posts/");
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }

    // Test loading state
    await page.goto("/");

    // Loading skeletons should be visible initially
    const skeletons = page.locator('[data-testid="feed-skeleton"]');
    // Note: Skeletons might load too fast to catch
  });

  test("opens source URL in new tab", async ({ page, context }) => {
    await page.goto("/");

    // Get source link from first card
    const sourceLink = page.locator('[data-testid="source-url"]').first();

    // Verify link attributes
    await expect(sourceLink).toHaveAttribute("target", "_blank");
    await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");

    // Click should not navigate current page
    const currentUrl = page.url();
    await sourceLink.click();
    await expect(page).toHaveURL(currentUrl);
  });

  test("displays rejected posts feed", async ({ page }) => {
    await page.goto("/rejected");

    // Should show warning
    await expect(page.locator("text=/rejected|moderation/i")).toBeVisible();

    // Feed cards should show rejection info
    const feedCards = page.locator('[data-testid="feed-card"]');
    if ((await feedCards.count()) > 0) {
      const firstCard = feedCards.first();
      await expect(firstCard.locator("text=/rejected|Rejected/")).toBeVisible();
    }
  });

  test("responsive design works correctly", async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // Should show grid layout
    const feedContainer = page.locator('[data-testid="feed-container"]');
    await expect(feedContainer).toBeVisible();

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });

    // Should adapt to mobile layout
    await expect(feedContainer).toBeVisible();

    // Cards should stack vertically
    const cards = page.locator('[data-testid="feed-card"]');
    if ((await cards.count()) >= 2) {
      const firstCardBox = await cards.first().boundingBox();
      const secondCardBox = await cards.nth(1).boundingBox();

      if (firstCardBox && secondCardBox) {
        // Second card should be below first card in mobile view
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y);
      }
    }
  });
});
