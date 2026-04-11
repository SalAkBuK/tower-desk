import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_BASE_URL = 'https://example.test/api';

async function loadUnitsApi() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    const units = await import('../../src/lib/api/units');
    const auth = await import('../../src/lib/auth');
    return { units, useAuthStore: auth.useAuthStore };
}

describe('units api', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('falls back to the base building units list when the backend rejects q', async () => {
        const { units, useAuthStore } = await loadUnitsApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === `${API_BASE_URL}/org/buildings/building-1/units?include=occupancy&q=TT-10`) {
                return new Response(JSON.stringify({
                    success: false,
                    error: {
                        code: 'Bad Request',
                        message: 'Validation failed',
                        details: ['property q should not exist'],
                    },
                }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' },
                });
            }

            if (url === `${API_BASE_URL}/org/buildings/building-1/units?include=occupancy`) {
                return new Response(JSON.stringify([
                    {
                        id: 'unit-1',
                        label: 'TT-101',
                        floor: 1,
                    },
                    {
                        id: 'unit-2',
                        label: 'TT-102',
                        floor: 1,
                    },
                ]), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(
            units.getBuildingUnits('building-1', {
                includeOccupancy: true,
                q: 'TT-10',
            })
        ).resolves.toEqual([
            expect.objectContaining({ id: 'unit-1', label: 'TT-101', floor: 1 }),
            expect.objectContaining({ id: 'unit-2', label: 'TT-102', floor: 1 }),
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
