import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('should display login form with email and password inputs', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should display submit button', async ({ page }) => {
    await page.goto('/login');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText('Sign In');
  });

  test('should have a link to the registration page', async ({ page }) => {
    await page.goto('/login');

    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveText('Create an account');
  });

  test('should navigate to register page when clicking registration link', async ({ page }) => {
    await page.goto('/login');

    await page.locator('a[href="/register"]').click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should display register page with name, email, and password fields', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
  });

  test('should show validation errors on empty form submission', async ({ page }) => {
    await page.goto('/login');

    // Focus and blur to trigger validation
    await page.locator('input[type="email"]').click();
    await page.locator('input[type="password"]').click();
    await page.locator('button[type="submit"]').click();

    // Expect validation messages to appear
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });
});
