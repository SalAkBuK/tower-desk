import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_BASE_URL = 'https://example.test/api';

async function loadClient() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    const client = await import('../../src/lib/api/client');
    const auth = await import('../../src/lib/auth');
    return { client, useAuthStore: auth.useAuthStore };
}

describe('api client', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('retries unauthorized requests through refresh single-flight', async () => {
        const { client, useAuthStore } = await loadClient();

        useAuthStore.setState({
            token: 'stale-token',
            refreshToken: 'refresh-token',
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        const hits = new Map<string, number>();
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            hits.set(url, (hits.get(url) ?? 0) + 1);

            if (url === `${API_BASE_URL}/auth/refresh`) {
                return new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }

            if (url === `${API_BASE_URL}/secure-a` || url === `${API_BASE_URL}/secure-b`) {
                const count = hits.get(url) ?? 0;
                if (count === 1) {
                    return new Response('Unauthorized', { status: 401 });
                }
                return new Response(JSON.stringify({ ok: true, url }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const [a, b] = await Promise.all([
            client.fetchJson('/secure-a'),
            client.fetchJson('/secure-b'),
        ]);

        expect(a).toEqual({ ok: true, url: `${API_BASE_URL}/secure-a` });
        expect(b).toEqual({ ok: true, url: `${API_BASE_URL}/secure-b` });
        expect(fetchMock.mock.calls.filter(([url]) => String(url) === `${API_BASE_URL}/auth/refresh`)).toHaveLength(1);
        expect(useAuthStore.getState().token).toBe('fresh-token');
    });

    it('uses the fallback endpoint after a 404', async () => {
        const { client, useAuthStore } = await loadClient();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === `${API_BASE_URL}/primary`) {
                return new Response(JSON.stringify({ message: 'not found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' },
                });
            }
            if (url === `${API_BASE_URL}/fallback`) {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(client.fetchJsonWithFallback('/primary', '/fallback')).resolves.toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('propagates non-silent failures with status and body', async () => {
        const { client, useAuthStore } = await loadClient();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'server exploded' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        })));

        await expect(client.fetchJson('/boom')).rejects.toMatchObject({
            message: 'Server error. Please try again in a moment.',
            status: 500,
            body: '{"message":"server exploded"}',
        });
    });

    it('preserves backend 403 messages without triggering unauthorized handling', async () => {
        const { client, useAuthStore } = await loadClient();

        useAuthStore.setState({
            token: 'token-123',
            refreshToken: 'refresh-token',
            user: {
                id: 'resident-1',
                name: 'Resident One',
                email: 'resident@example.com',
                role: 'tenant',
                baseRole: 'tenant',
                buildingIds: [],
            },
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        const unauthorizedHandler = vi.fn();
        client.setUnauthorizedHandler(unauthorizedHandler);

        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Active occupancy required' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
        })));

        await expect(client.fetchJson('/resident/requests')).rejects.toMatchObject({
            message: 'Active occupancy required',
            status: 403,
            body: '{"message":"Active occupancy required"}',
        });
        expect(unauthorizedHandler).not.toHaveBeenCalled();
    });
});
