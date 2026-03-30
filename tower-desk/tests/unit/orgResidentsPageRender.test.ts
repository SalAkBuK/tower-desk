import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrgResidentsPage } from "../../src/components/residents/OrgResidentsPage";

let authState = {
    user: { id: "user-1", buildingIds: ["building-1"] },
    baseRole: "building_admin",
};
let orgResidentsEnabled: boolean | undefined;
let directoryEnabledCalls: Array<boolean | undefined> = [];

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
    useAccessibleBuildings: () => ({
        data: [{ id: "building-1", name: "Tower One" }],
        isLoading: false,
    }),
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
            user: { id: "user-1", buildingIds: ["building-1"] },
            baseRole: "building_admin",
        };
        orgResidentsEnabled = undefined;
        directoryEnabledCalls = [];
    });

    it("keeps building admins on building-scoped resident data", () => {
        renderToStaticMarkup(createElement(OrgResidentsPage));

        expect(orgResidentsEnabled).toBe(false);
        expect(directoryEnabledCalls).toContain(true);
    });

    it("allows org admins to use org-wide resident data", () => {
        authState = {
            user: { id: "user-1", buildingIds: ["building-1"] },
            baseRole: "org_admin",
        };

        renderToStaticMarkup(createElement(OrgResidentsPage));

        expect(orgResidentsEnabled).toBe(true);
    });
});
