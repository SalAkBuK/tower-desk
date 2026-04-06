import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadNotificationsApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    const notificationsApi = await import("../../src/lib/api/notifications");
    const auth = await import("../../src/lib/auth");
    return { notificationsApi, useAuthStore: auth.useAuthStore };
}

describe("notifications api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns an empty notifications set for 403 responses", async () => {
        const { notificationsApi, useAuthStore } = await loadNotificationsApi();

        useAuthStore.setState({
            token: "token-123",
            refreshToken: null,
            user: {
                id: "user-1",
                name: "User One",
                email: "user@example.com",
                role: "viewer",
                baseRole: "org_admin",
                buildingIds: [],
                orgId: "org-1",
            },
            selectedOrgId: "org-1",
            selectedBuildingId: null,
        });

        const fetchMock = vi.fn(async () =>
            new Response(JSON.stringify({ message: "Forbidden" }), {
                status: 403,
                headers: { "content-type": "application/json" },
            })
        );

        vi.stubGlobal("fetch", fetchMock);

        await expect(notificationsApi.getNotifications({ limit: 10 })).resolves.toEqual({
            items: [],
            nextCursor: null,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("treats mark-all-read 403 responses as a silent no-op", async () => {
        const { notificationsApi, useAuthStore } = await loadNotificationsApi();

        useAuthStore.setState({
            token: "token-123",
            refreshToken: null,
            user: {
                id: "user-1",
                name: "User One",
                email: "user@example.com",
                role: "viewer",
                baseRole: "org_admin",
                buildingIds: [],
                orgId: "org-1",
            },
            selectedOrgId: "org-1",
            selectedBuildingId: null,
        });

        const fetchMock = vi.fn(async () =>
            new Response(JSON.stringify({ message: "Forbidden" }), {
                status: 403,
                headers: { "content-type": "application/json" },
            })
        );

        vi.stubGlobal("fetch", fetchMock);

        await expect(notificationsApi.markAllNotificationsRead()).resolves.toEqual({ success: false });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
