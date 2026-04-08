import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("auth store login merge", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(async () => {
        const auth = await import("../../src/lib/auth");
        auth.useAuthStore.setState({
            user: null,
            token: null,
            refreshToken: null,
            selectedOrgId: null,
            selectedBuildingId: null,
            status: "unauthenticated",
            hydrated: true,
            isAuthenticated: false,
            permissionsReady: false,
        });
    });

    it("does not leak the previous user's role into a new login", async () => {
        const auth = await import("../../src/lib/auth");

        auth.useAuthStore.setState({
            user: {
                id: "superadmin-1",
                name: "Alice Super",
                email: "alice@example.com",
                role: "superadmin",
                baseRole: "superadmin",
                buildingIds: [],
            },
            token: "old-token",
            refreshToken: "old-refresh",
            selectedOrgId: "org-1",
            selectedBuildingId: "building-1",
            status: "authenticated",
            hydrated: true,
            isAuthenticated: true,
            permissionsReady: true,
        });

        auth.useAuthStore.getState().login({
            id: "provider-1",
            name: "Clean Provider",
            email: "provider@example.com",
            role: "user",
            buildingIds: [],
        }, "new-token", "new-refresh");

        const nextState = auth.useAuthStore.getState();
        expect(nextState.user?.id).toBe("provider-1");
        expect(nextState.user?.role).toBe("user");
        expect(nextState.user?.baseRole).toBeUndefined();
        expect(nextState.selectedOrgId).toBeNull();
        expect(nextState.selectedBuildingId).toBeNull();
    });
});
