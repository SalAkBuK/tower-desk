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
        data: { items: [], nextCursor: null },
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
});
