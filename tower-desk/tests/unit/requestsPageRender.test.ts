import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestsPage } from "../../src/components/requests/RequestsPage";
import { getPrimaryManagementQueue, isClosedManagementRequest, isManagementActionableRequest } from "../../src/lib/requestQueueManagement";

let authState: any;
let buildingsData: any[] = [];
let requestsData: any[] = [];

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: (user: any) => new Set(user?.effectivePermissions ?? []),
    hasAnyPermission: () => true,
}));

vi.mock("@/lib/portalRegistry", () => ({
    getPortalModuleByKey: () => ({ rule: { prefixes: ["requests"] } }),
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: () => ({ data: buildingsData, isLoading: false }),
    useAdminRequests: (_buildingIds: string[], options?: { queue?: string }) => ({
        data: options?.queue ? requestsData.filter((entry) => entry.queue === options.queue) : requestsData,
        isLoading: false,
    }),
}));

vi.mock("@/components/requests/RequestDetailSheet", () => ({
    RequestDetailSheet: () => createElement("div", null, "Detail Sheet"),
}));

vi.mock("@/components/requests/RequestsTable", () => ({
    RequestsTable: ({ requests }: any) => createElement("div", null, requests.map((entry: any) => entry.title).join(", ")),
}));

vi.mock("@/components/requests/RequestsGrid", () => ({
    RequestsGrid: () => createElement("div", null, "Grid"),
}));

vi.mock("@/components/requests/RequestsViewToggle", () => ({
    RequestsViewToggle: () => createElement("div", null, "Toggle"),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", null, children),
    SelectTrigger: ({ children }: any) => createElement("button", null, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", null, children),
    SelectGroup: ({ children }: any) => createElement("div", null, children),
    SelectLabel: ({ children }: any) => createElement("div", null, children),
    SelectSeparator: () => createElement("hr"),
    SelectItem: ({ children }: any) => createElement("div", null, children),
}));

describe("RequestsPage render", () => {
    beforeEach(() => {
        authState = {
            user: { id: "user-1", effectivePermissions: ["requests.read"], buildingIds: ["building-1"] },
            baseRole: "manager",
            login: vi.fn(),
            token: "token",
            selectedBuildingId: "building-1",
            setSelectedBuildingId: vi.fn(),
        };
        buildingsData = [{ id: "building-1", name: "Central Tower" }];
        requestsData = [
            { id: "r1", title: "Leak", queue: "NEW", status: "pending", policy: { route: "DIRECT_ASSIGN" } },
            { id: "r2", title: "Quote needed", queue: "NEEDS_ESTIMATE", status: "pending" },
            { id: "r3", title: "Waiting on vendor", queue: "AWAITING_ESTIMATE", status: "pending", estimate: { status: "REQUESTED" } },
            { id: "r4", title: "Waiting on owner", queue: "AWAITING_OWNER", status: "pending", ownerApprovalStatus: "PENDING" },
            { id: "r5", title: "Assign tech", queue: "READY_TO_ASSIGN", status: "pending" },
            { id: "r6", title: "Assigned task", queue: "ASSIGNED", status: "assigned" },
            { id: "r7", title: "In progress task", queue: "IN_PROGRESS", status: "in-progress" },
            { id: "r8", title: "Overdue task", queue: "OVERDUE", status: "in-progress" },
        ];
    });

    it("renders the grouped status filter, summary stats, and result count", () => {
        const markup = renderToStaticMarkup(createElement(RequestsPage));

        expect(markup).toContain("Filter requests");
        expect(markup).toContain("Status");
        expect(markup).toContain("All Requests (8)");
        expect(markup).toContain("Assigned (1)");
        expect(markup).toContain("Completed (0)");
        expect(markup).toContain("Ready to Assign");
        expect(markup).toContain("Needs Estimate");
        expect(markup).toContain("Awaiting Estimate");
        expect(markup).toContain("Awaiting Owner");
        expect(markup).toContain("Assigned");
        expect(markup).toContain("In Progress");
        expect(markup).toContain("Overdue");
        expect(markup).toContain("Other statuses");
        expect(markup).toContain("Any Priority");
        expect(markup).toContain("Search requests, locations, staff...");
        expect(markup).toContain("Total");
        expect(markup).toContain("Showing 8 requests");
    });

    it("maps overdue execution work back into its primary queue", () => {
        expect(getPrimaryManagementQueue({
            id: "r-overdue",
            title: "Overdue execution",
            description: "",
            status: "in-progress",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "OVERDUE",
        } as any)).toBe("IN_PROGRESS");
    });

    it("treats completed requests as archive-only even if they still carry assignment metadata", () => {
        expect(isClosedManagementRequest({
            id: "r-completed",
            title: "Completed assigned work",
            description: "",
            status: "completed",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "ASSIGNED",
            serviceProvider: { id: "provider-1", name: "Clean House" },
            serviceProviderAssignedTo: { id: "worker-1", name: "Worker" },
        } as any)).toBe(true);
    });

    it("counts only actionable management workload for the requests badge", () => {
        expect(isManagementActionableRequest({
            id: "r-ready",
            title: "Ready",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "READY_TO_ASSIGN",
        } as any)).toBe(true);

        expect(isManagementActionableRequest({
            id: "r-assigned",
            title: "Assigned",
            description: "",
            status: "assigned",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "ASSIGNED",
        } as any)).toBe(false);

        expect(isManagementActionableRequest({
            id: "r-overdue",
            title: "Overdue execution",
            description: "",
            status: "in-progress",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "OVERDUE",
        } as any)).toBe(true);
    });
});
