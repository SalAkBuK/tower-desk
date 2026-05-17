import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    PROGRESS_REVIEW_DRAFT_CONFLICT_MESSAGE,
    RequestDetailSheet,
    getRequestDetailEstimateActionMode,
    getProgressReviewCommentText,
    submitProgressReviewComment,
} from "../../src/components/requests/RequestDetailSheet";

let authState: any;
let requestData: any;
let requestAssigneesData: any[] = [];
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
        NOT_REQUIRED: "Approval not required",
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
    useRequestAssignees: () => ({ data: requestAssigneesData }),
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
    requestTenancyContext: {
        occupancyIdAtCreation: "occupancy-1",
        leaseIdAtCreation: "lease-1",
        currentOccupancyId: "occupancy-1",
        currentLeaseId: "lease-1",
        isCurrentOccupancy: true,
        isCurrentLease: true,
        label: "CURRENT_OCCUPANCY",
        leaseLabel: "CURRENT_LEASE",
        tenancyContextSource: "SNAPSHOT",
        leaseContextSource: "SNAPSHOT",
    },
    comments: [],
    attachments: [],
    statusHistory: [],
    ...overrides,
});

describe("getRequestDetailEstimateActionMode", () => {
    it("switches the needs-estimate CTA to submit when a draft estimate exists", () => {
        expect(getRequestDetailEstimateActionMode({
            requestQueue: "NEW",
            policyRoute: "NEEDS_ESTIMATE",
            activeQueue: "NEEDS_ESTIMATE",
            hasDraftEstimateAmount: true,
            ownerApprovalRejected: false,
        })).toBe("submit");
    });

    it("only unlocks workflow submission in awaiting-estimate when management has entered an amount", () => {
        expect(getRequestDetailEstimateActionMode({
            requestQueue: "AWAITING_ESTIMATE",
            policyRoute: null,
            activeQueue: "AWAITING_ESTIMATE",
            hasDraftEstimateAmount: true,
            ownerApprovalRejected: false,
        })).toBe("workflow-submit");

        expect(getRequestDetailEstimateActionMode({
            requestQueue: "AWAITING_ESTIMATE",
            policyRoute: null,
            activeQueue: "AWAITING_ESTIMATE",
            hasDraftEstimateAmount: false,
            ownerApprovalRejected: false,
        })).toBe("none");
    });
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
        requestAssigneesData = [];
        serviceProvidersData = [];
    });

    it("renders the simplified workflow layout when request assignment is allowed", () => {
        requestData = buildRequest({
            queue: "NEW",
            status: "pending",
            policy: {
                route: "DIRECT_ASSIGN",
                recommendation: "PROCEED_NOW",
                summary: "Assign the request directly.",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Key details");
        expect(markup).toContain("Activity");
        expect(markup).toContain("Assignment");
        expect(markup).toContain("Workflow details");
        expect(markup).toContain("Assign Provider");
        expect(markup).toContain("More actions");
        expect(markup).not.toContain("Upload Attachment");
        expect(markup).not.toContain(">Files<");
        expect(markup).not.toContain("No estimate");
        expect(markup).not.toContain("No owner approval");
        expect(markup).not.toContain("Unknown");
        expect(markup).not.toMatch(/>Start Work</);
        expect(markup).not.toContain("Assign Provider Worker");
        expect(markup).toContain("Upload Admin Attachment");
        expect(markup).not.toContain("System decision");
        expect(markup).not.toContain("Request summary");
        expect(markup.match(/More actions/g)?.length ?? 0).toBe(1);
    });

    it("renders assignable staff from the request assignees endpoint", () => {
        requestData = buildRequest({
            queue: "READY_TO_ASSIGN",
            status: "pending",
        });
        requestAssigneesData = [
            {
                userId: "custom-staff-1",
                email: "custom.staff@example.test",
                name: "Custom Template Staff",
                isActive: true,
                buildingAccess: [{
                    assignmentId: "assignment-1",
                    roleTemplateId: "template-1",
                    roleTemplateKey: "custom_maintenance_operator",
                    scopeType: "BUILDING",
                    scopeId: "building-1",
                }],
            },
        ];

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Custom Template Staff");
        expect(markup).toContain('data-value="custom-staff-1"');
    });

    it("renders management-friendly resident context when the request detail includes it", () => {
        requestData = buildRequest({
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
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Resident context");
        expect(markup).toContain("Resident status");
        expect(markup).toContain("Former resident");
        expect(markup).not.toContain("Expired invite");
        expect(markup).toContain("Unit occupancy now");
        expect(markup).toContain("Occupied by Current Resident");
        expect(markup).toContain("Historical request from a former resident.");
        expect(markup).toContain("This unit is now occupied by someone else or no longer occupied by the requester.");
        expect(markup).toContain("Request cycle");
        expect(markup).toContain("Stay context");
        expect(markup).toContain("Current Stay");
        expect(markup).toContain("Lease context");
        expect(markup).toContain("Current Lease");
        expect(markup).not.toContain("Explicit creation snapshot");
    });

    it("renders tenancy-cycle context when the management request detail includes it", () => {
        requestData = buildRequest({
            requestTenancyContext: {
                occupancyIdAtCreation: "occupancy-1",
                leaseIdAtCreation: "lease-1",
                currentOccupancyId: "occupancy-2",
                currentLeaseId: "lease-2",
                isCurrentOccupancy: false,
                isCurrentLease: false,
                label: "PREVIOUS_OCCUPANCY",
                leaseLabel: "PREVIOUS_LEASE",
                tenancyContextSource: "HISTORICAL_INFERENCE",
                leaseContextSource: "UNRESOLVED",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Previous Stay");
        expect(markup).toContain("Previous Lease");
        expect(markup).toContain("Inferred from history");
        expect(markup).toContain("Legacy linkage is incomplete");
    });

    it("hides obvious resident and request-cycle context for current residents", () => {
        requestData = buildRequest({
            requesterContext: {
                isResident: true,
                residentOccupancyStatus: "ACTIVE",
                residentInviteStatus: null,
                isFormerResident: false,
                currentUnitOccupiedByRequester: true,
                currentUnitOccupant: {
                    userId: "tenant-1",
                    name: "Tenant User",
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
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).not.toContain("Resident context");
        expect(markup).not.toContain("Resident status");
        expect(markup).not.toContain("Unit occupancy now");
        expect(markup).not.toContain("Requester still occupies this unit");
        expect(markup).not.toContain("Request cycle");
        expect(markup).not.toContain("Stay context");
        expect(markup).not.toContain("Lease context");
        expect(markup).not.toContain("Current Stay");
        expect(markup).not.toContain("Current Lease");
        expect(markup).not.toContain("Inferred from history");
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
        expect(markup).toContain("Awaiting owner approval");
        expect(markup).not.toMatch(/>Start Work</);
    });

    it("treats NOT_REQUIRED owner-visible work as FYI instead of blocked approval", () => {
        requestData = buildRequest({
            queue: "AWAITING_OWNER",
            status: "pending",
            ownerApprovalStatus: "NOT_REQUIRED",
            ownerApproval: {
                status: "NOT_REQUIRED",
            },
            policy: {
                route: "DIRECT_ASSIGN",
                recommendation: "PROCEED_AND_NOTIFY",
                summary: "Proceed and notify owner.",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Owner notified, approval not required");
        expect(markup).toContain("Approval not required");
        expect(markup).toContain("Assign Staff");
        expect(markup).not.toContain("Execution is blocked while owner approval is pending.");
        expect(markup).not.toContain("Awaiting owner approval");
        expect(markup).not.toContain("Request Owner Approval");
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

        expect(markup).toContain("Owner rejected. Work is blocked.");
        expect(markup).toContain("Execution is blocked until the estimate or request details are revised.");
        expect(markup).toContain("The owner rejected this approval request. Revise the estimate or request details and submit again.");
        expect(markup).toContain("Revise Estimate");
        expect(markup).toContain("Update review job");
        expect(markup).toContain("Submit estimate");
        expect(markup).toContain("Advanced review");
        expect(markup).not.toContain("Waiting for owner approval");
        expect(markup).not.toContain("Force Start Work");
    });

    it("keeps management estimate submission in a separate section", () => {
        requestData = buildRequest({
            queue: "AWAITING_ESTIMATE",
            status: "pending",
            estimate: {
                status: "REQUESTED",
                dueAt: "2026-04-08T12:00:00.000Z",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Use the separate Submit estimate section when management needs to submit the amount directly.");
        expect(markup).toContain("Submit estimate");
        expect(markup).toContain("Estimated Currency");
        expect(markup).toContain("value=\"AED\"");
        expect(markup).toContain("Submit the estimate and let the backend return the final queue and approval state.");
        expect(markup).not.toContain("Submit Estimate Fallback");
        expect(markup).toContain("Reassign Estimate Provider");
    });

    it("previews estimate threshold outcome before backend submission", () => {
        requestData = buildRequest({
            queue: "NEEDS_ESTIMATE",
            status: "pending",
            ownerApproval: {
                status: "NOT_REQUIRED",
                estimatedAmount: "950",
                estimatedCurrency: "AED",
            },
        });

        const belowThresholdMarkup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(belowThresholdMarkup).toContain("Owner approval not required");
        expect(belowThresholdMarkup).toContain("Estimate preview: 950 AED");
        expect(belowThresholdMarkup).toContain("Estimate submission");
        expect(belowThresholdMarkup).toContain("Secondary review save");
        expect(belowThresholdMarkup).toContain("Advanced policy flags");

        requestData = buildRequest({
            queue: "NEEDS_ESTIMATE",
            status: "pending",
            ownerApproval: {
                status: "NOT_REQUIRED",
                estimatedAmount: "1500",
                estimatedCurrency: "AED",
            },
        });

        const aboveThresholdMarkup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(aboveThresholdMarkup).toContain("Owner approval required");
        expect(aboveThresholdMarkup).toContain("Estimate preview: 1500 AED");
    });

    it("blocks owner-approval-required policy without showing awaiting owner before pending status", () => {
        requestData = buildRequest({
            queue: "READY_TO_ASSIGN",
            status: "pending",
            ownerApprovalStatus: "NOT_REQUIRED",
            ownerApproval: {
                status: "NOT_REQUIRED",
            },
            policy: {
                route: "OWNER_APPROVAL_REQUIRED",
                recommendation: "REQUEST_OWNER_APPROVAL",
                summary: "Backend policy requires owner approval.",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Owner approval required");
        expect(markup).toContain("Execution is blocked because backend policy requires owner approval.");
        expect(markup).not.toContain("Awaiting owner approval");
    });

    it("shows estimate facts but hides editable estimate controls once the request is assigned", () => {
        requestData = buildRequest({
            queue: "ASSIGNED",
            status: "assigned",
            policy: {
                route: "EMERGENCY_DISPATCH",
                recommendation: "PROCEED_AND_NOTIFY",
                summary: "Emergency indicators suggest immediate dispatch and owner notification.",
                isEmergency: true,
            },
            ownerApproval: {
                estimatedAmount: "350",
                estimatedCurrency: "AED",
                deadlineAt: "2026-04-29T10:02:00.000Z",
            },
        });

        const markup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(markup).toContain("Approval Amount");
        expect(markup).toContain("350 AED");
        expect(markup).toContain("Owner Approval Deadline");
        expect(markup).not.toContain('id="estimate-amount"');
        expect(markup).not.toContain('id="owner-approval-deadline"');
    });

    it("shows provider context without provider-worker dispatch controls", () => {
        requestData = buildRequest({
            assignedTo: {
                id: "staff-1",
                fullName: "Staff Assignee",
            },
        });

        const withoutProviderMarkup = renderToStaticMarkup(
            createElement(RequestDetailSheet, {
                requestId: "request-1",
                buildingId: "building-1",
                onClose: vi.fn(),
            })
        );

        expect(withoutProviderMarkup).not.toContain("Unassign Provider");
        expect(withoutProviderMarkup).not.toContain("Assign Provider Worker");
        expect(withoutProviderMarkup).toContain("Staff Assignee");
        expect(withoutProviderMarkup).not.toContain("Provider: Unassigned");
        expect(withoutProviderMarkup).not.toContain("Provider Worker");

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
        expect(markup).not.toContain("Follow Up");
        expect(markup).not.toContain("Follow-up tools");
        expect(markup).not.toContain("No primary action right now");
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

    it("posts the canned progress review comment instead of only prefilling a draft", async () => {
        const submitComment = vi.fn().mockResolvedValue(undefined);

        const result = await submitProgressReviewComment({
            requestId: "request-1",
            buildingId: "building-1",
            canComment: true,
            hasDraft: false,
            canSeeInternalComments: true,
            commentVisibility: "INTERNAL",
            isOverdue: true,
            submitComment,
        });

        expect(submitComment).toHaveBeenCalledWith({
            requestId: "request-1",
            buildingId: "building-1",
            commentText: getProgressReviewCommentText(true),
            visibility: "INTERNAL",
        });
        expect(result).toEqual({ status: "posted", message: "Escalation comment posted" });
    });

    it("blocks the canned progress review action when there is already a draft comment", async () => {
        const submitComment = vi.fn();

        const result = await submitProgressReviewComment({
            requestId: "request-1",
            buildingId: "building-1",
            canComment: true,
            hasDraft: true,
            canSeeInternalComments: true,
            commentVisibility: "SHARED",
            isOverdue: false,
            submitComment,
        });

        expect(submitComment).not.toHaveBeenCalled();
        expect(result).toEqual({ status: "blocked", message: PROGRESS_REVIEW_DRAFT_CONFLICT_MESSAGE });
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
