import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalDashboardPage } from "../../src/components/dashboard/PortalDashboardPage";

let authState = {
    user: {
        id: "user-1",
        effectivePermissions: ["dashboard.read"],
        roleKeys: [],
        orgRoleKeys: [],
    },
};

let activityState = {
    items: [] as Array<{
        type: string;
        title: string;
        description?: string;
        entityType?: string;
        entityId?: string;
        buildingName?: string;
        occurredAt: string;
    }>,
    nextCursor: null as string | null,
};

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/queries", () => ({
    useDashboardOverview: () => ({
        data: {
            generatedAt: "2026-04-03T10:00:00.000Z",
            summary: {
                buildingsTotal: 0,
                unitsTotal: 0,
                occupiedUnits: 0,
                vacantUnits: 0,
                occupancyRate: 0,
                activeLeases: 0,
                openMaintenanceRequests: 0,
                overdueMaintenanceRequests: 0,
                visitorsToday: 0,
                activeParkingAllocations: 0,
                broadcastsLast30Days: 0,
                unreadNotifications: 0,
            },
            trends: {
                maintenance: [],
                visitors: [],
                broadcasts: [],
            },
            buildings: [],
        },
        isLoading: false,
        isError: false,
        error: null,
    }),
    useDashboardActivity: () => ({
        data: activityState,
        isLoading: false,
        isError: false,
        error: null,
    }),
}));

describe("PortalDashboardPage", () => {
    beforeEach(() => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["dashboard.read"],
                roleKeys: [],
                orgRoleKeys: [],
            },
        };
        activityState = { items: [], nextCursor: null };
    });

    it("renders dashboard empty states for orgs with no buildings", () => {
        const markup = renderToStaticMarkup(createElement(PortalDashboardPage));

        expect(markup).toContain("Dashboard");
        expect(markup).toContain("No buildings in scope yet.");
        expect(markup).toContain("No recent activity yet.");
    });

    it("renders access message when dashboard permission is missing", () => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            },
        };

        const markup = renderToStaticMarkup(createElement(PortalDashboardPage));

        expect(markup).toContain("You do not have permission to view dashboard data.");
    });

    it("does not render opaque activity identifiers", () => {
        activityState = {
            items: [
                {
                    type: "lease.created",
                    title: "Lease created",
                    description: "Dubai Tower - Unit 101",
                    entityType: "lease",
                    entityId: "84ac1bd4-53ae-47a0-88f4-10ce21458c32",
                    buildingName: "Dubai Tower",
                    occurredAt: "2026-04-14T18:32:00.000Z",
                },
            ],
            nextCursor: null,
        };

        const markup = renderToStaticMarkup(createElement(PortalDashboardPage));

        expect(markup).toContain("Lease created");
        expect(markup).toContain("Dubai Tower");
        expect(markup).not.toContain("lease:84ac1bd4-53ae-47a0-88f4-10ce21458c32");
    });
});
