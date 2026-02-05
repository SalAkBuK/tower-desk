import { test, expect } from '@playwright/test';

const buildAuthStorage = (overrides: Record<string, unknown> = {}) => ({
    state: {
        user: null,
        token: 'expired-token',
        refreshToken: null,
        selectedOrgId: null,
        selectedBuildingId: null,
        ...overrides
    },
    version: 1
});

test('expired token redirects to login', async ({ page }) => {
    await page.route('**/users/me', (route) =>
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({}) })
    );

    await page.addInitScript((storageValue) => {
        localStorage.setItem('auth-storage', JSON.stringify(storageValue));
    }, buildAuthStorage());

    await page.goto('/admin/requests', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
});

test('network failure falls back to login (no infinite spinner)', async ({ page }) => {
    await page.route('**/users/me', (route) => route.abort());

    await page.addInitScript((storageValue) => {
        localStorage.setItem('auth-storage', JSON.stringify(storageValue));
    }, buildAuthStorage({ token: 'offline-token' }));

    await page.goto('/admin/requests', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
});
