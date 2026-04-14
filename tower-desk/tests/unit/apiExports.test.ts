import { afterEach, describe, expect, it, vi } from 'vitest';

const API_BASE_URL = 'https://example.test/api';

async function loadApiModules() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    const [barrel, auth, communications, ownerPortal, parking, platform, providerRequests, providers, client] = await Promise.all([
        import('../../src/lib/api'),
        import('../../src/lib/api/auth'),
        import('../../src/lib/api/communications'),
        import('../../src/lib/api/ownerPortal'),
        import('../../src/lib/api/parking'),
        import('../../src/lib/api/platform'),
        import('../../src/lib/api/providerRequests'),
        import('../../src/lib/api/providers'),
        import('../../src/lib/api/client'),
    ]);
    return { barrel, auth, communications, ownerPortal, parking, platform, providerRequests, providers, client };
}

describe('api re-exports', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps the facade aligned with domain entrypoints', async () => {
        const { barrel, auth, communications, ownerPortal, parking, platform, providerRequests, providers, client } = await loadApiModules();

        expect(barrel.login).toBe(auth.login);
        expect(barrel.getBroadcasts).toBe(communications.getBroadcasts);
        expect(barrel.getOwnerPortfolioSummary).toBe(ownerPortal.getOwnerPortfolioSummary);
        expect(barrel.getOccupancyVehicles).toBe(parking.getOccupancyVehicles);
        expect(barrel.listDeliveryTasks).toBe(platform.listDeliveryTasks);
        expect(barrel.getProviderRequests).toBe(providerRequests.getProviderRequests);
        expect(barrel.getProviderProfile).toBe(providers.getProviderProfile);
        expect(barrel.setUnauthorizedHandler).toBe(client.setUnauthorizedHandler);
    });
});
