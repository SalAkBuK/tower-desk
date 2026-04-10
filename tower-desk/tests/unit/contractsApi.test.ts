import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_BASE_URL = 'https://example.test/api';

async function loadContractsApi() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    const contracts = await import('../../src/lib/api/contracts');
    const auth = await import('../../src/lib/auth');
    return { contracts, useAuthStore: auth.useAuthStore };
}

describe('contracts api normalization', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('preserves raw cancelled status and derives moved-out display status from occupancy endAt', async () => {
        const { contracts, useAuthStore } = await loadContractsApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url !== `${API_BASE_URL}/org/contracts`) {
                throw new Error(`Unexpected fetch URL: ${url}`);
            }
            return new Response(JSON.stringify({
                items: [{
                    id: 'contract-1',
                    buildingId: 'building-1',
                    unitId: 'unit-1',
                    residentUserId: 'resident-1',
                    status: 'CANCELLED',
                    contractPeriodFrom: '2026-01-01T00:00:00.000Z',
                    contractPeriodTo: '2026-12-31T23:59:59.000Z',
                    annualRent: '50000.00',
                    paymentFrequency: 'MONTHLY',
                    securityDepositAmount: '5000.00',
                    occupancy: {
                        id: 'occ-1',
                        endAt: '2026-04-01T00:00:00.000Z',
                    },
                }],
                nextCursor: null,
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }));

        const result = await contracts.getOrgLeases();

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.status).toBe('CANCELLED');
        expect(result.items[0]?.displayStatus).toBe('MOVED_OUT');
        expect(result.items[0]?.actualMoveOutDate).toBe('2026-04-01T00:00:00.000Z');
    });

    it('maps snake_case move-out markers to moved-out display status', async () => {
        const { contracts, useAuthStore } = await loadContractsApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url !== `${API_BASE_URL}/org/contracts`) {
                throw new Error(`Unexpected fetch URL: ${url}`);
            }
            return new Response(JSON.stringify({
                items: [{
                    id: 'contract-2',
                    buildingId: 'building-1',
                    unitId: 'unit-2',
                    residentUserId: 'resident-2',
                    status: 'CANCELLED',
                    contractPeriodFrom: '2026-01-01T00:00:00.000Z',
                    contractPeriodTo: '2026-12-31T23:59:59.000Z',
                    annualRent: '60000.00',
                    paymentFrequency: 'MONTHLY',
                    securityDepositAmount: '6000.00',
                    moved_out_at: '2026-04-02T00:00:00.000Z',
                }],
                nextCursor: null,
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }));

        const result = await contracts.getOrgLeases();

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.status).toBe('CANCELLED');
        expect(result.items[0]?.displayStatus).toBe('MOVED_OUT');
        expect(result.items[0]?.actualMoveOutDate).toBe('2026-04-02T00:00:00.000Z');
    });
});
