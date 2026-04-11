import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalBuildingsPage } from "../../src/components/buildings/PortalBuildingsPage";

let authState: any = {
    user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: ["buildings.read"] },
    baseRole: "building_admin",
    login: vi.fn(),
    token: "token-1",
};
let accessibleBuildingsEnabled: boolean | undefined;
let adminRequestsEnabled: boolean | undefined;
let adminUsersEnabled: boolean | undefined;

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as any),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueries: () => [
        { data: [{ id: "unit-1" }, { id: "unit-2" }, { id: "unit-3" }], isLoading: false },
    ],
}));

vi.mock("@/lib/api/units", () => ({
    getBuildingUnits: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: (user?: { effectivePermissions?: string[] }) => new Set(user?.effectivePermissions ?? []),
    hasAnyPermission: (permissionSet: Set<string>, options?: { keys?: string[]; prefixes?: string[] }) => {
        const keys = options?.keys ?? [];
        const prefixes = options?.prefixes ?? [];
        for (const key of keys) {
            if (permissionSet.has(String(key).toLowerCase())) return true;
        }
        for (const prefix of prefixes) {
            const normalized = String(prefix).toLowerCase();
            for (const entry of permissionSet) {
                if (entry === normalized || entry.startsWith(`${normalized}.`)) return true;
            }
        }
        return false;
    },
}));

vi.mock("@/lib/portalRegistry", () => ({
    getPortalModuleByKey: (key: string) => {
        if (key === "buildings") return { rule: { prefixes: ["buildings"] } };
        return null;
    },
}));

vi.mock("@/components/buildings/CreateBuildingSheet", () => ({
    CreateBuildingSheet: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: (_userId?: string, _baseRole?: string, options?: { enabled?: boolean }) => {
        accessibleBuildingsEnabled = options?.enabled;
        return {
        data: [{ id: "building-1", name: "Tower One", status: "active", unitsCount: 12 }],
        isLoading: false,
        };
    },
    useAdminRequests: (_buildingIds?: string[], options?: { enabled?: boolean }) => {
        adminRequestsEnabled = options?.enabled;
        return { data: [] };
    },
    useAdminUsers: (_buildingIds?: string[], options?: { enabled?: boolean }) => {
        adminUsersEnabled = options?.enabled;
        return { data: [] };
    },
    useDeleteBuilding: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
}));

describe("PortalBuildingsPage", () => {
    beforeEach(() => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: ["buildings.read"] },
            baseRole: "building_admin",
            login: vi.fn(),
            token: "token-1",
        };
        accessibleBuildingsEnabled = undefined;
        adminRequestsEnabled = undefined;
        adminUsersEnabled = undefined;
    });

    it("hides building creation for building-scoped roles", () => {
        const markup = renderToStaticMarkup(createElement(PortalBuildingsPage));

        expect(markup).not.toContain("Create Building");
        expect(accessibleBuildingsEnabled).toBe(true);
        expect(adminRequestsEnabled).toBe(true);
        expect(adminUsersEnabled).toBe(true);
    });

    it("shows building creation for org admins", () => {
        authState = {
            ...authState,
            baseRole: "org_admin",
        };

        const markup = renderToStaticMarkup(createElement(PortalBuildingsPage));

        expect(markup).toContain("Create Building");
    });

    it("disables building queries when the user lacks buildings permissions", () => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: [] },
            baseRole: "building_admin",
            login: vi.fn(),
            token: "token-1",
        };

        const markup = renderToStaticMarkup(createElement(PortalBuildingsPage));

        expect(markup).toContain("You do not have permission to view buildings.");
        expect(accessibleBuildingsEnabled).toBe(false);
        expect(adminRequestsEnabled).toBe(false);
        expect(adminUsersEnabled).toBe(false);
    });
});
