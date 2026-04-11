import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderRequestsPage } from "../../src/components/provider-portal/ProviderRequestsPage";

let authState: any;
let requestsData: any[] = [];
let unreadCount = 0;
let requestDetail: any = null;
let commentsData: any[] = [];
let providerRuntimeContext: any = null;
let providerStaffData: any[] = [];

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
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

vi.mock("@/lib/cloudinary", () => ({
    uploadToCloudinary: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
    useProviderRuntimeContext: () => ({
        data: providerRuntimeContext,
        isLoading: false,
    }),
    useProviderRequests: () => ({
        data: requestsData,
        isLoading: false,
    }),
    useProviderRequestUnreadCount: () => ({
        data: unreadCount,
    }),
    useProviderStaff: () => ({
        data: providerStaffData,
    }),
    useProviderRequest: () => ({
        data: requestDetail,
    }),
    useProviderRequestComments: () => ({
        data: commentsData,
    }),
    useAssignProviderRequestWorker: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useUpdateProviderRequestStatus: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useAddProviderRequestComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useAddProviderRequestAttachments: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, disabled, asChild, ...props }: any) =>
        asChild
            ? createElement("span", props, children)
            : createElement("button", { ...props, "data-disabled": disabled ? "true" : "false" }, children),
}));

vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => createElement("input", props),
}));

vi.mock("@/components/ui/textarea", () => ({
    Textarea: (props: any) => createElement("textarea", props),
}));

vi.mock("@/components/ui/badge", () => ({
    Badge: ({ children, ...props }: any) => createElement("span", props, children),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", { "data-slot": "select" }, children),
    SelectTrigger: ({ children }: any) => createElement("button", { "data-slot": "select-trigger" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, value }: any) => createElement("div", { "data-value": value }, children),
}));

describe("ProviderRequestsPage render", () => {
    beforeEach(() => {
        authState = {
            baseRole: "service_provider",
        };
        requestsData = [{
            id: "request-1",
            title: "Water leakage",
            description: "Kitchen sink is leaking",
            status: "assigned",
            priority: "high",
            buildingId: "building-1",
            buildingName: "Central Tower",
            createdByTenantId: "tenant-1",
            createdAt: "2026-04-07T08:00:00.000Z",
            updatedAt: "2026-04-07T09:00:00.000Z",
            unit: { label: "A-1204" },
            requestTenancyContext: {
                occupancyIdAtCreation: "occupancy-1",
                leaseIdAtCreation: "lease-1",
                currentOccupancyId: "occupancy-1",
                currentLeaseId: "lease-1",
                isCurrentOccupancy: true,
                isCurrentLease: true,
                label: "CURRENT_OCCUPANCY",
                leaseLabel: "CURRENT_LEASE",
                tenancyContextSource: "HISTORICAL_INFERENCE",
                leaseContextSource: "HISTORICAL_INFERENCE",
            },
        }];
        unreadCount = 4;
        requestDetail = {
            ...requestsData[0],
            type: "PLUMBING",
            createdBy: { name: "Resident User" },
            requesterContext: {
                isResident: false,
                residentOccupancyStatus: "FORMER",
                residentInviteStatus: "EXPIRED",
                isFormerResident: true,
                currentUnitOccupiedByRequester: false,
                currentUnitOccupant: {
                    userId: "resident-2",
                    name: "Current Resident",
                },
            },
            requestTenancyContext: {
                occupancyIdAtCreation: "occupancy-1",
                leaseIdAtCreation: "lease-1",
                currentOccupancyId: "occupancy-1",
                currentLeaseId: "lease-1",
                isCurrentOccupancy: true,
                isCurrentLease: true,
                label: "CURRENT_OCCUPANCY",
                leaseLabel: "CURRENT_LEASE",
                tenancyContextSource: "HISTORICAL_INFERENCE",
                leaseContextSource: "HISTORICAL_INFERENCE",
            },
            serviceProviderAssignedTo: { id: "worker-1", name: "Vendor Worker" },
            availableWorkers: [
                { userId: "worker-1", name: "Vendor Worker", role: "WORKER", membershipIsActive: true, userIsActive: true },
            ],
            attachments: [],
        };
        commentsData = [{
            id: "comment-1",
            commentText: "We are onsite now.",
            createdAt: "2026-04-07T09:30:00.000Z",
            user: { userId: "worker-1", fullName: "Vendor Worker" },
        }];
        providerRuntimeContext = {
            userId: "provider-user-1",
            email: "admin@rapidfix.test",
            providers: [
                {
                    providerId: "provider-1",
                    name: "RapidFix Technical Services",
                    role: "ADMIN",
                    membershipIsActive: true,
                },
            ],
        };
        providerStaffData = [
            { userId: "worker-1", name: "Vendor Worker", role: "WORKER", membershipIsActive: true, userIsActive: true },
        ];
    });

    it("renders provider inbox, manager controls, and shared comments", () => {
        const markup = renderToStaticMarkup(createElement(ProviderRequestsPage));

        expect(markup).toContain("Request Queue");
        expect(markup).toContain("Unread Comments");
        expect(markup).toContain("Tenancy Context");
        expect(markup).toContain("Current Cycle");
        expect(markup).toContain("Historical");
        expect(markup).toContain("Legacy Context");
        expect(markup).toContain("All Cycles");
        expect(markup).toContain("Worker assignment");
        expect(markup).toContain("Assign worker");
        expect(markup).toContain("Status actions");
        expect(markup).toContain("Shared comments");
        expect(markup).toContain("Former Resident");
        expect(markup).toContain("Current Occupancy");
        expect(markup).toContain("Current Lease");
        expect(markup).toContain("Resolved from history");
        expect(markup).toContain("Current occupant: Current Resident");
        expect(markup).toContain("Requester no longer has an active occupancy. This request remains visible as a historical record.");
        expect(markup).toContain("Current occupant is different from the original requester.");
        expect(markup).toContain("We are onsite now.");
    });

    it("shows the provider-only message for non-provider roles", () => {
        authState = { baseRole: "manager" };

        const markup = renderToStaticMarkup(createElement(ProviderRequestsPage));

        expect(markup).toContain("This portal surface is limited to provider managers.");
    });

    it("shows an empty worker state instead of a manual worker id field", () => {
        requestDetail = {
            ...requestDetail,
            availableWorkers: [],
            serviceProviderAssignedTo: null,
        };
        providerStaffData = [];

        const markup = renderToStaticMarkup(createElement(ProviderRequestsPage));

        expect(markup).toContain("No active provider workers are available for assignment.");
        expect(markup).not.toContain("Enter worker user ID");
    });

    it("falls back to provider staff when request detail omits available workers", () => {
        requestDetail = {
            ...requestDetail,
            availableWorkers: [],
            serviceProviderAssignedTo: null,
        };

        const markup = renderToStaticMarkup(createElement(ProviderRequestsPage));

        expect(markup).toContain("Vendor Worker");
        expect(markup).not.toContain("No active provider workers are available for assignment.");
    });
});
