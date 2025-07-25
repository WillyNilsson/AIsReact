import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test("user can register a new account", async ({ page }) => {
    await page.goto("/auth/register");

    // Fill registration form
    await page.fill('input[name="username"]', "newuser123");
    await page.fill('input[name="email"]', "newuser@example.com");
    await page.fill('input[name="password"]', "SecurePass123!");
    await page.fill('input[name="confirmPassword"]', "SecurePass123!");

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to login or home
    await expect(page).toHaveURL(/\/(login|$)/);
  });

  test("user can login with valid credentials", async ({ page }) => {
    await page.goto("/auth/login");

    // Fill login form
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "TestPass123!");

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to home
    await expect(page).toHaveURL("/");

    // Should show user info in header
    await expect(page.locator("text=testuser")).toBeVisible();
  });

  test("shows error message for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");

    // Fill with invalid credentials
    await page.fill('input[name="username"]', "invaliduser");
    await page.fill('input[name="password"]', "wrongpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(
      page.locator("text=/Invalid credentials|Incorrect username/"),
    ).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL("/auth/login");
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    // Try to access protected route
    await page.goto("/submit");

    // Should redirect to login
    await expect(page).toHaveURL("/auth/login");
  });

  test("persists authentication on page reload", async ({ page }) => {
    // Login first
    await page.goto("/auth/login");
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL("/");

    // Reload page
    await page.reload();

    // Should still be on home
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=testuser")).toBeVisible();
  });

  test("user can logout", async ({ page }) => {
    // Login first
    await page.goto("/auth/login");
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Find and click logout button
    await page.click('button:has-text("Logout")');

    // Should redirect to home or login
    await expect(page).toHaveURL(/^\/(login)?$/);

    // Should not show user info
    await expect(page.locator("text=testuser")).not.toBeVisible();
  });

  test("shows password strength indicator during registration", async ({
    page,
  }) => {
    await page.goto("/auth/register");

    const passwordInput = page.locator('input[name="password"]');
    const strengthIndicator = page.locator('[data-testid="password-strength"]');

    // Weak password
    await passwordInput.fill("weak");
    await expect(strengthIndicator).toContainText(/Weak|Poor/);

    // Medium password
    await passwordInput.fill("Medium123");
    await expect(strengthIndicator).toContainText(/Medium|Fair/);

    // Strong password
    await passwordInput.fill("StrongPass123!@#");
    await expect(strengthIndicator).toContainText(/Strong|Excellent/);
  });

  test("validates registration form fields", async ({ page }) => {
    await page.goto("/auth/register");

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator("text=Username is required")).toBeVisible();
    await expect(page.locator("text=Email is required")).toBeVisible();
    await expect(page.locator("text=Password is required")).toBeVisible();

    // Test email validation
    await page.fill('input[name="email"]', "invalid-email");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid email")).toBeVisible();

    // Test password mismatch
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="confirmPassword"]', "Different123!");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Passwords do not match")).toBeVisible();
  });
});
