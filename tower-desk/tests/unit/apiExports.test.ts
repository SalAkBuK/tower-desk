import { afterEach, describe, expect, it, vi } from 'vitest';

const API_BASE_URL = 'https://example.test/api';

async function loadApiModules() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    const [barrel, auth, communications, parking, client] = await Promise.all([
        import('../../src/lib/api'),
        import('../../src/lib/api/auth'),
        import('../../src/lib/api/communications'),
        import('../../src/lib/api/parking'),
        import('../../src/lib/api/client'),
    ]);
    return { barrel, auth, communications, parking, client };
}

describe('api re-exports', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps the facade aligned with domain entrypoints', async () => {
        const { barrel, auth, communications, parking, client } = await loadApiModules();

        expect(barrel.login).toBe(auth.login);
        expect(barrel.getBroadcasts).toBe(communications.getBroadcasts);
        expect(barrel.getOccupancyVehicles).toBe(parking.getOccupancyVehicles);
        expect(barrel.setUnauthorizedHandler).toBe(client.setUnauthorizedHandler);
    });
});
