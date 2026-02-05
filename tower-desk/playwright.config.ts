import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
    testDir: './tests/e2e',
    use: {
        baseURL
    },
    webServer: process.env.PLAYWRIGHT_SKIP_SERVER
        ? undefined
        : {
            command: 'npm run dev -- --port 3000',
            port: 3000,
            reuseExistingServer: !process.env.CI,
            env: {
                NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api',
                NEXT_PUBLIC_AUTH_RESTORE_TIMEOUT_MS: process.env.NEXT_PUBLIC_AUTH_RESTORE_TIMEOUT_MS || '3000',
                NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS: process.env.NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS || '2000'
            }
        }
});
