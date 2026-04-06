import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrgResidentsPage } from "../../src/components/residents/OrgResidentsPage";

let authState: any = {
    user: { id: "user-1", buildingIds: ["building-1"] },
    baseRole: "building_admin",
};
let orgResidentsEnabled: boolean | undefined;
let directoryEnabledCalls: Array<boolean | undefined> = [];
let accessibleBuildingsEnabled: boolean | undefined;

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as any),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
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
        if (key === "residents") return { rule: { prefixes: ["residents"] } };
        return null;
    },
}));

vi.mock("@/lib/leaseNavigation", () => ({
    buildLeasesHref: () => "/portal/contracts",
    resolveLeasesLandingTabFromResidentFilter: () => "leases",
    resolveResidentLeaseModuleHref: () => "/portal/contracts",
}));

vi.mock("@/components/residents/CreateTenantDialog", () => ({
    CreateTenantDialog: () => null,
}));

vi.mock("@/components/residents/EditResidentDialog", () => ({
    EditResidentDialog: () => null,
}));

vi.mock("@/components/residents/ResidentLeaseHistoryDialog", () => ({
    ResidentLeaseHistoryDialog: () => null,
}));

vi.mock("@/components/residents/ResidentInviteMonitor", () => ({
    ResidentInviteMonitor: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: (_userId?: string, _baseRole?: string, options?: { enabled?: boolean }) => {
        accessibleBuildingsEnabled = options?.enabled;
        return {
        data: [{ id: "building-1", name: "Tower One" }],
        isLoading: false,
        };
    },
    useOrgResidents: (_params?: unknown, options?: { enabled?: boolean }) => {
        orgResidentsEnabled = options?.enabled;
        return {
            data: { items: [], nextCursor: null },
            isLoading: false,
            isError: false,
            error: null,
            isFetching: false,
        };
    },
    useResendResidentInvite: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useResidentDirectory: (_buildingId?: string, params?: { enabled?: boolean }) => {
        directoryEnabledCalls.push(params?.enabled);
        return {
            data: { items: [], nextCursor: null },
            isLoading: false,
            isError: false,
            error: null,
            isFetching: false,
        };
    },
}));

describe("OrgResidentsPage scope", () => {
    beforeEach(() => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: ["residents.read"] },
            baseRole: "building_admin",
        };
        orgResidentsEnabled = undefined;
        directoryEnabledCalls = [];
        accessibleBuildingsEnabled = undefined;
    });

    it("keeps building admins on building-scoped resident data", () => {
        renderToStaticMarkup(createElement(OrgResidentsPage));

        expect(orgResidentsEnabled).toBe(false);
        expect(directoryEnabledCalls).toContain(true);
        expect(accessibleBuildingsEnabled).toBe(true);
    });

    it("allows org admins to use org-wide resident data", () => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: ["residents.read"] },
            baseRole: "org_admin",
        };

        renderToStaticMarkup(createElement(OrgResidentsPage));

        expect(orgResidentsEnabled).toBe(true);
    });

    it("disables resident queries when the user lacks residents permissions", () => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"], effectivePermissions: [] },
            baseRole: "building_admin",
        };

        const markup = renderToStaticMarkup(createElement(OrgResidentsPage));

        expect(markup).toContain("You do not have permission to view residents.");
        expect(accessibleBuildingsEnabled).toBe(false);
        expect(orgResidentsEnabled).toBe(false);
        expect(directoryEnabledCalls).toContain(false);
    });
});
