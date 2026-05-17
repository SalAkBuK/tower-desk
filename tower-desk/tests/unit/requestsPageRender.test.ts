import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestsPage } from "../../src/components/requests/RequestsPage";
import { getPrimaryManagementQueue, isClosedManagementRequest, isManagementActionableRequest, isNewManagementRequest } from "../../src/lib/requestQueueManagement";
import {
    getRequestLeaseRowBadgeLabel,
    getRequestTenancyRowBadgeLabel,
    isCurrentRequestTenancyContext,
    isHistoricalRequestTenancyContext,
    isLegacyRequestTenancyContext,
} from "../../src/lib/requestTenancyContext";

let authState: any;
let buildingsData: any[] = [];
let requestsData: any[] = [];

const currentCycleContext = {
    label: "CURRENT_OCCUPANCY",
    leaseLabel: "CURRENT_LEASE",
    tenancyContextSource: "SNAPSHOT",
    leaseContextSource: "SNAPSHOT",
};

vi.mock("next/navigation", () => ({
    usePathname: () => "/portal/requests",
    useRouter: () => ({
        replace: vi.fn(),
    }),
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
    RequestsTable: ({ requests }: any) => createElement("div", { className: "requests-table" }, requests.map((entry: any) => entry.title).join(", ")),
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
            { id: "r1", title: "Leak", queue: "NEW", status: "pending", policy: { route: "DIRECT_ASSIGN" }, requestTenancyContext: currentCycleContext },
            { id: "r2", title: "Quote needed", queue: "NEEDS_ESTIMATE", status: "pending", requestTenancyContext: currentCycleContext },
            { id: "r3", title: "Waiting on vendor", queue: "AWAITING_ESTIMATE", status: "pending", estimate: { status: "REQUESTED" }, requestTenancyContext: currentCycleContext },
            { id: "r4", title: "Waiting on owner", queue: "AWAITING_OWNER", status: "pending", ownerApprovalStatus: "PENDING", requestTenancyContext: currentCycleContext },
            { id: "r5", title: "Assign tech", queue: "READY_TO_ASSIGN", status: "pending", requestTenancyContext: currentCycleContext },
            { id: "r6", title: "Assigned task", queue: "ASSIGNED", status: "assigned", requestTenancyContext: currentCycleContext },
            { id: "r7", title: "In progress task", queue: "IN_PROGRESS", status: "in-progress", requestTenancyContext: currentCycleContext },
            { id: "r8", title: "Overdue task", queue: "OVERDUE", status: "in-progress", requestTenancyContext: currentCycleContext },
            {
                id: "r9",
                title: "Previous lease repair",
                queue: "ASSIGNED",
                status: "assigned",
                requestTenancyContext: {
                    label: "PREVIOUS_OCCUPANCY",
                    leaseLabel: "PREVIOUS_LEASE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "HISTORICAL_INFERENCE",
                },
            },
            {
                id: "r10",
                title: "Unknown tenancy context request",
                queue: "READY_TO_ASSIGN",
                status: "pending",
                requestTenancyContext: {
                    label: "UNKNOWN_TENANCY_CYCLE",
                    leaseLabel: "UNKNOWN_LEASE_CYCLE",
                    tenancyContextSource: "UNRESOLVED",
                    leaseContextSource: "UNRESOLVED",
                },
            },
            {
                id: "r11",
                title: "Lease snapshot still missing",
                queue: "READY_TO_ASSIGN",
                status: "pending",
                requestTenancyContext: {
                    label: "CURRENT_OCCUPANCY",
                    leaseLabel: "UNKNOWN_LEASE_CYCLE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "UNRESOLVED",
                },
            },
        ];
    });

    it("renders the compact filter controls and current-view summary", () => {
        const markup = renderToStaticMarkup(createElement(RequestsPage));

        expect(markup).toContain("Track, assign, and resolve maintenance work across your buildings.");
        expect(markup).toContain("Search and filter");
        expect(markup).toContain("Use the filters below to narrow workflow, ownership, lifecycle, or context.");
        expect(markup).toContain("Workflow");
        expect(markup).toContain("Includes closed and historical only when explicitly selected.");
        expect(markup).toContain("All Open");
        expect(markup).toContain("New / Unreviewed");
        expect(markup).toContain("Needs Estimate");
        expect(markup).toContain("Ready to Assign");
        expect(markup).toContain("Assigned");
        expect(markup).toContain("In Progress");
        expect(markup).toContain("Awaiting Estimate");
        expect(markup).toContain("Awaiting Owner");
        expect(markup).toContain("Overdue");
        expect(markup).toContain("Closed");
        expect(markup).toContain("Historical");
        expect(markup).toContain("Open");
        expect(markup).toContain("Awaiting Estimate");
        expect(markup).toContain("Awaiting Owner");
        expect(markup).toContain("Ready to Assign");
        expect(markup).toContain("Search");
        expect(markup).toContain("Any priority");
        expect(markup).toContain("Any assignee");
        expect(markup).toContain("Search requests, locations, or IDs...");
        expect(markup).toContain("More filters");
        expect(markup).toContain("Advanced filters narrow lifecycle, context, and approval.");
        expect(markup).toContain("Workflow: All Open");
        expect(markup).toContain("9 requests in current view");
        expect(markup).not.toContain("Filter and review");
        expect(markup).not.toContain("Workflow rail");
        expect(markup).not.toContain("Workflow focus");
        expect(markup).not.toContain("Current lane:");
        expect(markup).not.toContain("Request status");
        expect(markup).not.toContain("Request context");
        expect(markup).not.toContain("Approval state");
        expect(markup).not.toContain("Operational Queue");
        expect(markup).not.toContain("Archived");
        expect(markup).not.toContain("Previous lease repair");
        expect(markup).not.toContain("Unknown tenancy context request");
    });

    it("keeps operational views limited to current-occupancy requests", () => {
        requestsData = [
            {
                id: "tt101-1",
                title: "Repair cabnet",
                queue: "NEEDS_ESTIMATE",
                status: "pending",
                requestTenancyContext: {
                    label: "PREVIOUS_OCCUPANCY",
                    leaseLabel: "PREVIOUS_LEASE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "HISTORICAL_INFERENCE",
                },
            },
            {
                id: "tt101-2",
                title: "Clean flat",
                queue: "NEEDS_ESTIMATE",
                status: "pending",
                requestTenancyContext: {
                    label: "PREVIOUS_OCCUPANCY",
                    leaseLabel: "PREVIOUS_LEASE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "HISTORICAL_INFERENCE",
                },
            },
            {
                id: "tt101-3",
                title: "Leakage",
                queue: "ASSIGNED",
                status: "assigned",
                requestTenancyContext: {
                    label: "NO_ACTIVE_OCCUPANCY",
                    leaseLabel: "NO_ACTIVE_LEASE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "HISTORICAL_INFERENCE",
                },
            },
            {
                id: "tt102-1",
                title: "Test guest",
                queue: "ASSIGNED",
                status: "assigned",
                requestTenancyContext: {
                    label: "CURRENT_OCCUPANCY",
                    leaseLabel: "CURRENT_LEASE",
                    tenancyContextSource: "HISTORICAL_INFERENCE",
                    leaseContextSource: "HISTORICAL_INFERENCE",
                },
            },
        ];

        const markup = renderToStaticMarkup(createElement(RequestsPage));
        expect(markup).toContain("All Open");
        expect(markup).toContain("Historical");
        expect(markup).toContain("1 request in current view");
        expect(markup).toContain("Test guest");
        expect(markup).not.toContain("Repair cabnet");
        expect(markup).not.toContain("Clean flat");
        expect(markup).not.toContain("Leakage");
        expect(markup).not.toContain("Archived");
    });

    it("orders visible requests by newest creation date first", () => {
        requestsData = [
            {
                id: "older-overdue",
                title: "Older overdue",
                queue: "OVERDUE",
                status: "in-progress",
                createdAt: "2026-04-01T09:00:00.000Z",
                updatedAt: "2026-04-15T09:00:00.000Z",
                requestTenancyContext: currentCycleContext,
            },
            {
                id: "newest-request",
                title: "Newest request",
                queue: "NEW",
                status: "pending",
                createdAt: "2026-04-12T09:00:00.000Z",
                updatedAt: "2026-04-12T09:00:00.000Z",
                requestTenancyContext: currentCycleContext,
            },
            {
                id: "middle-request",
                title: "Middle request",
                queue: "READY_TO_ASSIGN",
                status: "pending",
                createdAt: "2026-04-05T09:00:00.000Z",
                updatedAt: "2026-04-06T09:00:00.000Z",
                requestTenancyContext: currentCycleContext,
            },
        ];

        const markup = renderToStaticMarkup(createElement(RequestsPage));

        expect(markup.indexOf("Newest request")).toBeLessThan(markup.indexOf("Middle request"));
        expect(markup.indexOf("Middle request")).toBeLessThan(markup.indexOf("Older overdue"));
    });

    it("does not keep resetting building scope when all buildings is already selected", () => {
        const setSelectedBuildingId = vi.fn();
        authState = {
            ...authState,
            selectedBuildingId: null,
            setSelectedBuildingId,
        };

        renderToStaticMarkup(createElement(RequestsPage));

        expect(setSelectedBuildingId).not.toHaveBeenCalled();
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
            requestTenancyContext: currentCycleContext,
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
            requestTenancyContext: currentCycleContext,
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
            requestTenancyContext: currentCycleContext,
        } as any)).toBe(true);

        expect(isManagementActionableRequest({
            id: "r-historical-ready",
            title: "Historical ready",
            description: "",
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
        } as any)).toBe(false);
    });

    it("keeps owner FYI requests ready to assign instead of awaiting owner", () => {
        expect(getPrimaryManagementQueue({
            id: "r-owner-fyi",
            title: "Simple owner visible repair",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "AWAITING_OWNER",
            ownerApprovalStatus: "NOT_REQUIRED",
            policy: {
                route: "DIRECT_ASSIGN",
                recommendation: "PROCEED_AND_NOTIFY",
            },
        } as any)).toBe("READY_TO_ASSIGN");
    });

    it("separates needs-estimate intake from awaiting-estimate execution block", () => {
        expect(getPrimaryManagementQueue({
            id: "r-needs-estimate",
            title: "Scope unclear",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            policy: { route: "NEEDS_ESTIMATE", recommendation: "GET_ESTIMATE" },
        } as any)).toBe("NEEDS_ESTIMATE");

        expect(getPrimaryManagementQueue({
            id: "r-awaiting-estimate",
            title: "Vendor quote requested",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            estimate: { status: "REQUESTED" },
        } as any)).toBe("AWAITING_ESTIMATE");
    });

    it("treats intake-stage requests as new management work", () => {
        expect(isNewManagementRequest({
            id: "r-new",
            title: "Fresh intake",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "NEW",
        } as any)).toBe(true);

        expect(isNewManagementRequest({
            id: "r-ready",
            title: "Ready for assignment",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "READY_TO_ASSIGN",
        } as any)).toBe(true);

        expect(isNewManagementRequest({
            id: "r-estimate",
            title: "Needs estimate",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "NEEDS_ESTIMATE",
        } as any)).toBe(true);

        expect(isNewManagementRequest({
            id: "r-owner",
            title: "Waiting for owner",
            description: "",
            status: "pending",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "AWAITING_OWNER",
            ownerApprovalStatus: "PENDING",
        } as any)).toBe(false);

        expect(isNewManagementRequest({
            id: "r-assigned",
            title: "Assigned execution",
            description: "",
            status: "assigned",
            priority: "medium",
            buildingId: "building-1",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-04T00:00:00.000Z",
            updatedAt: "2026-04-04T00:00:00.000Z",
            queue: "ASSIGNED",
        } as any)).toBe(false);
    });

    it("treats only explicit previous or inactive occupancies as historical", () => {
        expect(isCurrentRequestTenancyContext({
            label: "CURRENT_OCCUPANCY",
            leaseLabel: "UNKNOWN_LEASE_CYCLE",
        } as any)).toBe(true);

        expect(isHistoricalRequestTenancyContext({
            label: "PREVIOUS_OCCUPANCY",
            leaseLabel: "PREVIOUS_LEASE",
        } as any)).toBe(true);

        expect(isHistoricalRequestTenancyContext({
            label: "NO_ACTIVE_OCCUPANCY",
            leaseLabel: "NO_ACTIVE_LEASE",
        } as any)).toBe(true);

        expect(isHistoricalRequestTenancyContext({
            label: "UNKNOWN_TENANCY_CYCLE",
            leaseLabel: "UNKNOWN_LEASE_CYCLE",
        } as any)).toBe(false);
    });

    it("treats unknown or missing tenancy labels as legacy context only", () => {
        expect(isLegacyRequestTenancyContext({
            label: "UNKNOWN_TENANCY_CYCLE",
            leaseLabel: "UNKNOWN_LEASE_CYCLE",
        } as any)).toBe(true);

        expect(isLegacyRequestTenancyContext({
            label: "CURRENT_OCCUPANCY",
            leaseLabel: "UNKNOWN_LEASE_CYCLE",
        } as any)).toBe(false);

        expect(isLegacyRequestTenancyContext({
            label: "PREVIOUS_OCCUPANCY",
            leaseLabel: "PREVIOUS_LEASE",
        } as any)).toBe(false);

        expect(isLegacyRequestTenancyContext({
            label: null,
            leaseLabel: "CURRENT_LEASE",
        } as any)).toBe(true);

        expect(isLegacyRequestTenancyContext(undefined)).toBe(true);
    });

    it("maps row tenancy badges to operational copy", () => {
        expect(getRequestTenancyRowBadgeLabel({
            label: "CURRENT_OCCUPANCY",
            leaseLabel: "CURRENT_LEASE",
        } as any)).toBe("Current Stay");

        expect(getRequestTenancyRowBadgeLabel({
            label: "PREVIOUS_OCCUPANCY",
            leaseLabel: "PREVIOUS_LEASE",
        } as any)).toBe("Previous Stay");

        expect(getRequestTenancyRowBadgeLabel({
            label: "NO_ACTIVE_OCCUPANCY",
            leaseLabel: "NO_ACTIVE_LEASE",
        } as any)).toBe("Requester Moved Out");

        expect(getRequestTenancyRowBadgeLabel({
            label: "UNKNOWN_TENANCY_CYCLE",
            leaseLabel: "UNKNOWN_LEASE_CYCLE",
            tenancyContextSource: "UNRESOLVED",
        } as any)).toBe("Legacy Record");

        expect(getRequestLeaseRowBadgeLabel({
            label: "PREVIOUS_OCCUPANCY",
            leaseLabel: "NO_ACTIVE_LEASE",
        } as any)).toBe("Previous Lease");
    });
});
