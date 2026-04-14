import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../../src/components/layout/Sidebar";

let authState: any;
let requestsData: any[] = [];
let accessibleBuildingsData: any[] = [];
let pathname = "/portal/requests";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: any) => createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/queries", () => ({
    useOrgProfile: () => ({ data: { name: "TowerDesk" } }),
    useAccessibleBuildings: () => ({ data: accessibleBuildingsData }),
    useAdminRequests: () => ({ data: requestsData }),
    useConversations: () => ({ data: { items: [] } }),
    usePendingContractMoveRequestsCount: () => ({ data: 0 }),
    useProviderRuntimeContext: () => ({ data: null, isLoading: false }),
    useProviderRequestUnreadCount: () => ({ data: 0 }),
    useOwnerRequestCommentUnreadCount: () => ({ data: 0 }),
    useOwnerConversationUnreadCount: () => ({ data: 0 }),
    useOwnerNotificationUnreadCount: () => ({ data: 0 }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

describe("Sidebar requests badge", () => {
    beforeEach(() => {
        authState = {
            role: "manager",
            baseRole: "manager",
            logout: vi.fn(),
            user: {
                id: "manager-1",
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["requests.read", "dashboard.read"],
            },
        };

        accessibleBuildingsData = [{ id: "building-1", name: "Central Tower" }];
        requestsData = [
            {
                id: "current-actionable",
                title: "Current actionable",
                status: "pending",
                priority: "medium",
                buildingId: "building-1",
                createdByTenantId: "tenant-1",
                createdAt: "2026-04-04T00:00:00.000Z",
                updatedAt: "2026-04-04T00:00:00.000Z",
                queue: "READY_TO_ASSIGN",
                requestTenancyContext: {
                    label: "CURRENT_OCCUPANCY",
                    leaseLabel: "CURRENT_LEASE",
                },
            },
            {
                id: "current-non-actionable",
                title: "Current assigned",
                status: "assigned",
                priority: "medium",
                buildingId: "building-1",
                createdByTenantId: "tenant-1",
                createdAt: "2026-04-04T00:00:00.000Z",
                updatedAt: "2026-04-04T00:00:00.000Z",
                queue: "ASSIGNED",
                requestTenancyContext: {
                    label: "CURRENT_OCCUPANCY",
                    leaseLabel: "CURRENT_LEASE",
                },
            },
            {
                id: "historical-actionable-looking",
                title: "Historical ready",
                status: "pending",
                priority: "medium",
                buildingId: "building-1",
                createdByTenantId: "tenant-1",
                createdAt: "2026-04-04T00:00:00.000Z",
                updatedAt: "2026-04-04T00:00:00.000Z",
                queue: "READY_TO_ASSIGN",
                requestTenancyContext: {
                    label: "PREVIOUS_OCCUPANCY",
                    leaseLabel: "PREVIOUS_LEASE",
                },
            },
        ];
    });

    it("shows only current actionable operator workload in the requests badge", () => {
        const markup = renderToStaticMarkup(createElement(Sidebar));

        expect(markup).toContain(">Requests<");
        expect(markup).toContain(">1<");
        expect(markup).not.toContain(">2<");
    });
});
