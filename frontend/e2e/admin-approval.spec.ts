import { test, expect } from '@playwright/test';

test.describe('Admin Approval Workflow', () => {
  test('should redirect unauthenticated user to login when accessing admin dashboard', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to login when accessing manage requests page', async ({ page }) => {
    await page.goto('/admin/requests');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to login when accessing manage schedules', async ({ page }) => {
    await page.goto('/admin/schedules');

    await expect(page).toHaveURL(/\/login/);
  });

  test('should confirm admin routes exist by verifying redirect to login', async ({ page }) => {
    // Verify that admin/requests route is defined (redirects to login, not a blank page)
    await page.goto('/admin/requests');

    // The login form being visible confirms the redirect happened (route is defined)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
