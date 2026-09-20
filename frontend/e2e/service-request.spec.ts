import { test, expect } from '@playwright/test';

test.describe('Service Request Page', () => {
  test('should redirect unauthenticated user to login when accessing service request form', async ({ page }) => {
    await page.goto('/service-request');

    // ProtectedRoute should redirect to /login for unauthenticated users
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to login when accessing my requests', async ({ page }) => {
    await page.goto('/my-requests');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should have the service request route defined in the app', async ({ page }) => {
    // Verify that navigating to /service-request doesn't result in a 404-like page
    // It should redirect to login (which confirms the route exists and is protected)
    await page.goto('/service-request');

    // The presence of the login form confirms we were redirected (route exists)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
