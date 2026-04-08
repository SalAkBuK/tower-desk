import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestDetailSheet } from "../../src/components/requests/RequestDetailSheet";

let authState: any;
let requestData: any;
let serviceProvidersData: any[] = [];

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
    getUserPermissionSet: (user: any) => new Set(user?.effectivePermissions ?? []),
    hasPermissionPrefix: (permissionSet: Set<string>, prefix: string) =>
        Array.from(permissionSet).some((entry) => entry === prefix || entry.startsWith(`${prefix}.`)),
}));

vi.mock("@/lib/requestPermissions", () => ({
    canAssignRequests: (permissionSet: Set<string>) => permissionSet.has("requests.assign"),
    canCommentOnRequests: () => true,
    canUpdateRequestStatuses: () => true,
}));

vi.mock("@/lib/roles", () => ({
    isBuildingScopedManagementRole: () => true,
}));

vi.mock("@/lib/debugAuth", () => ({
    DEBUG_AUTH: false,
    logAuth: vi.fn(),
}));

vi.mock("framer-motion", () => ({
    AnimatePresence: ({ children }: any) => createElement("div", null, children),
    motion: new Proxy({}, {
        get: () => ({ children, layoutId: _layoutId, ...props }: any) => createElement("div", props, children),
    }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, disabled, ...props }: any) =>
        createElement("button", { ...props, "data-disabled": disabled ? "true" : "false" }, children),
}));

vi.mock("@/components/ui/badge", () => ({
    Badge: ({ children, ...props }: any) => createElement("span", props, children),
}));

vi.mock("@/components/ui/textarea", () => ({
    Textarea: (props: any) => createElement("textarea", props),
}));

vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => createElement("input", props),
}));

vi.mock("@/components/ui/checkbox", () => ({
    Checkbox: ({ checked, onCheckedChange, ...props }: any) =>
        createElement("input", {
            type: "checkbox",
            checked,
            onChange: (event: any) => onCheckedChange?.(event.target.checked),
            ...props,
        }),
}));

vi.mock("@/components/ui/label", () => ({
    Label: ({ children, ...props }: any) => createElement("label", props, children),
}));

vi.mock("@/components/ui/separator", () => ({
    Separator: () => createElement("hr"),
}));

vi.mock("@/components/ui/avatar", () => ({
    Avatar: ({ children }: any) => createElement("div", null, children),
    AvatarFallback: ({ children }: any) => createElement("span", null, children),
}));

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: any) => createElement("div", null, children),
    DialogContent: ({ children }: any) => createElement("div", null, children),
    DialogTitle: ({ children }: any) => createElement("h2", null, children),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", { "data-slot": "select" }, children),
    SelectTrigger: ({ children, disabled }: any) =>
        createElement("button", { "data-slot": "select-trigger", "data-disabled": disabled ? "true" : "false" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, value }: any) => createElement("div", { "data-value": value }, children),
}));

vi.mock("@/components/requests/requestDisplay", () => ({
    recommendationLabels: {
        PROCEED_NOW: "Proceed now",
        GET_ESTIMATE: "Get estimate",
        REQUEST_OWNER_APPROVAL: "Request owner approval",
        PROCEED_AND_NOTIFY: "Proceed and notify owner",
    },
    recommendationStyles: {
        PROCEED_NOW: "",
        GET_ESTIMATE: "",
        REQUEST_OWNER_APPROVAL: "",
        PROCEED_AND_NOTIFY: "",
    },
    policyRouteLabels: {
        DIRECT_ASSIGN: "Direct assign",
        EMERGENCY_DISPATCH: "Emergency dispatch",
        NEEDS_ESTIMATE: "Needs estimate",
        OWNER_APPROVAL_REQUIRED: "Owner approval required",
    },
    estimateStatusLabels: {
        NOT_REQUESTED: "No estimate",
        REQUESTED: "Estimate requested",
        SUBMITTED: "Estimate submitted",
    },
    estimateStatusStyles: {
        NOT_REQUESTED: "",
        REQUESTED: "",
        SUBMITTED: "",
    },
    ownerApprovalStatusLabels: {
        NOT_REQUIRED: "No owner approval",
        PENDING: "Owner pending",
        APPROVED: "Owner approved",
        REJECTED: "Owner rejected",
    },
    ownerApprovalStatusStyles: {
        NOT_REQUIRED: "",
        PENDING: "",
        APPROVED: "",
        REJECTED: "",
    },
    requestQueueLabels: {
        NEW: "New",
        NEEDS_ESTIMATE: "Needs Estimate",
        AWAITING_ESTIMATE: "Awaiting Estimate",
        AWAITING_OWNER: "Awaiting Owner",
        READY_TO_ASSIGN: "Ready to Assign",
        ASSIGNED: "Assigned",
        IN_PROGRESS: "In Progress",
        OVERDUE: "Overdue",
    },
    requestQueueStyles: {
        NEW: "",
        NEEDS_ESTIMATE: "",
        AWAITING_ESTIMATE: "",
        AWAITING_OWNER: "",
        READY_TO_ASSIGN: "",
        ASSIGNED: "",
        IN_PROGRESS: "",
        OVERDUE: "",
    },
    statusLabels: {
        pending: "Pending",
        assigned: "Assigned",
        "in-progress": "In Progress",
        "on-hold": "On Hold",
        completed: "Completed",
        cancelled: "Cancelled",
    },
    statusStyles: {
        pending: "",
        assigned: "",
        "in-progress": "",
        "on-hold": "",
        completed: "",
        cancelled: "",
    },
    getStatusIcon: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useRequest: () => ({ data: requestData, isLoading: false }),
    useServiceProviders: () => ({ data: serviceProvidersData }),
    useAdminUsers: () => ({ data: [] }),
    useUsers: () => ({ data: [] }),
    useUpdateRequestStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCancelRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useAssignRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useAssignRequestProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUnassignRequestProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRequestEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSubmitRequestEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useTriageRequestPolicy: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRequestOwnerApprovalNow: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSendOwnerApprovalReminder: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useOverrideOwnerApproval: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useAddRequestComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useAddRequestAttachments: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const buildRequest = (overrides?: Record<string, unknown>) => ({
    id: "request-1",
    title: "Fix lobby leak",
    description: "Pipe leak near the front desk",
    status: "assigned",
    priority: "high",
    buildingId: "building-1",
    createdByTenantId: "tenant-1",
    createdBy: { name: "Tenant User" },
    createdAt: "2026-04-07T10:00:00.000Z",
    updatedAt: "2026-04-07T11:00:00.000Z",
    unit: { id: "unit-1", label: "A-1102", floor: 11 },
    comments: [],
    attachments: [],
    statusHistory: [],
    ...overrides,
});

describe("RequestDetailSheet provider assignment", () => {
    beforeEach(() => {
        authState = {
            user: {
                id: "user-1",
                effectivePermissions: ["requests.assign"],
            },
            baseRole: "manager",
            buildingScope: ["building-1"],
        };
        requestData = buildRequest();
        serviceProvidersData = [];
    });

    it("renders the simplified workflow layout when request assignment is allowed", () => {
        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Request overview");
        expect(markup).toContain("System decision");
        expect(markup).toContain("Activity");
        expect(markup).toContain("Assignment");
        expect(markup).toContain("Policy Details");
        expect(markup).toContain("Owner Approval Details");
        expect(markup).toContain("Assign Provider");
        expect(markup).toContain("Advanced Actions");
        expect(markup).not.toContain("Upload Attachment");
        expect(markup).not.toMatch(/>Start Work</);
        expect(markup).not.toContain("Assign Provider Worker");
        expect(markup).toContain("Force Start Work");
        expect(markup).toContain("Upload Admin Attachment");
        expect(markup.match(/Advanced Actions/g)?.length ?? 0).toBe(1);
    });

    it("shows only active providers linked to the current building", () => {
        serviceProvidersData = [
            {
                id: "provider-1",
                name: "RapidFix",
                isActive: true,
                linkedBuildings: [{ buildingId: "building-1" }],
                providerAdminAccessGrants: [],
            },
            {
                id: "provider-2",
                name: "Inactive Vendor",
                isActive: false,
                linkedBuildings: [{ buildingId: "building-1" }],
                providerAdminAccessGrants: [],
            },
            {
                id: "provider-3",
                name: "Wrong Building Vendor",
                isActive: true,
                linkedBuildings: [{ buildingId: "building-2" }],
                providerAdminAccessGrants: [],
            },
        ];

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("RapidFix");
        expect(markup).not.toContain("Inactive Vendor");
        expect(markup).not.toContain("Wrong Building Vendor");
    });

    it("disables provider assignment when owner approval is pending", () => {
        requestData = buildRequest({
            queue: "AWAITING_OWNER",
            ownerApprovalStatus: "PENDING",
            ownerApproval: {
                status: "PENDING",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Execution is blocked while owner approval is pending.");
        expect(markup).toContain("Waiting for Owner");
        expect(markup).not.toMatch(/>Start Work</);
    });

    it("shows a recovery path when owner approval was rejected", () => {
        requestData = buildRequest({
            queue: "AWAITING_OWNER",
            status: "pending",
            estimate: {
                status: "SUBMITTED",
                submittedAt: "2026-04-07T12:00:00.000Z",
                submittedByUserId: "user-1",
            },
            ownerApprovalStatus: "REJECTED",
            ownerApproval: {
                status: "REJECTED",
                decidedAt: "2026-04-07T13:00:00.000Z",
                reason: "Too expensive",
                estimatedAmount: "1800",
                estimatedCurrency: "AED",
            },
            policy: {
                route: "OWNER_APPROVAL_REQUIRED",
                recommendation: "REQUEST_OWNER_APPROVAL",
                summary: "Owner approval required before execution.",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Owner rejected");
        expect(markup).toContain("Execution is blocked until the estimate or request details are revised.");
        expect(markup).toContain("The owner rejected this approval request. Revise the estimate or request details and submit again.");
        expect(markup).toContain("Revise Estimate");
        expect(markup).toContain("Edit Triage");
        expect(markup).not.toContain("Waiting for Owner");
        expect(markup).not.toContain("Force Start Work");
    });

    it("shows provider context without provider-worker dispatch controls", () => {
        requestData = buildRequest();

        const withoutProviderMarkup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(withoutProviderMarkup).not.toContain("Unassign Provider");
        expect(withoutProviderMarkup).not.toContain("Assign Provider Worker");

        requestData = buildRequest({
            serviceProvider: {
                id: "provider-1",
                name: "RapidFix",
                serviceCategory: "Plumbing",
            },
        });
        serviceProvidersData = [{
            id: "provider-1",
            name: "RapidFix",
            isActive: true,
            linkedBuildings: [{ buildingId: "building-1" }],
            providerAdminAccessGrants: [],
        }];

        const withProviderMarkup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(withProviderMarkup).not.toContain("Unassign Provider");
        expect(withProviderMarkup).toContain("RapidFix");
        expect(withProviderMarkup).not.toContain("Assign Provider Worker");
    });

    it("does not render a duplicate status badge when queue and status have the same label", () => {
        requestData = buildRequest({
            queue: "ASSIGNED",
            status: "assigned",
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain('data-request-badge="queue"');
        expect(markup).not.toContain('data-request-badge="status"');
    });

    it("keeps assigned requests read-only for execution and provider worker dispatch on web", () => {
        requestData = buildRequest({
            queue: "ASSIGNED",
            status: "assigned",
            serviceProvider: {
                id: "provider-1",
                name: "RapidFix",
                serviceCategory: "Plumbing",
            },
            serviceProviderAssignedTo: {
                id: "worker-1",
                name: "Vendor Worker",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).not.toMatch(/>Start Work</);
        expect(markup).not.toContain("Assign Provider Worker");
        expect(markup).not.toContain("Upload Attachment");
        expect(markup).toContain("Vendor Worker");
        expect(markup).toContain("Follow Up");
        expect(markup).toContain("Force Start Work");
    });

    it("keeps completion as an advanced fallback for in-progress requests", () => {
        requestData = buildRequest({
            queue: "IN_PROGRESS",
            status: "in-progress",
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Review Progress");
        expect(markup).not.toMatch(/>Mark Completed</);
        expect(markup).toContain("Force Complete");
    });

    it("shows only the 2 latest comments by default", () => {
        requestData = buildRequest({
            comments: [
                {
                    id: "comment-1",
                    commentText: "Oldest note",
                    visibility: "SHARED",
                    createdAt: "2026-04-07T10:00:00.000Z",
                    user: { fullName: "Manager One" },
                },
                {
                    id: "comment-2",
                    commentText: "Middle note",
                    visibility: "SHARED",
                    createdAt: "2026-04-07T11:00:00.000Z",
                    user: { fullName: "Manager Two" },
                },
                {
                    id: "comment-3",
                    commentText: "Latest note",
                    visibility: "SHARED",
                    createdAt: "2026-04-07T12:00:00.000Z",
                    user: { fullName: "Manager Three" },
                },
            ],
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).not.toContain("Oldest note");
        expect(markup).toContain("Middle note");
        expect(markup).toContain("Latest note");
        expect(markup).toContain("Show 1 older comment");
    });
});
