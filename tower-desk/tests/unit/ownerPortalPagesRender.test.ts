import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OwnerDashboardPage } from "../../src/components/owner-portal/OwnerDashboardPage";
import { OwnerMessagesPage } from "../../src/components/owner-portal/OwnerMessagesPage";
import { OwnerNotificationsPage } from "../../src/components/owner-portal/OwnerNotificationsPage";
import { OwnerRequestsPage } from "../../src/components/owner-portal/OwnerRequestsPage";

let authState: any;

const ownerRequests = [
    {
        id: "request-1",
        orgId: "org-1",
        orgName: "TowerDesk Management",
        buildingId: "building-1",
        buildingName: "Central Tower",
        title: "Water leakage",
        description: "Kitchen sink is leaking",
        status: "pending",
        priority: "high",
        createdAt: "2026-04-06T10:00:00.000Z",
        updatedAt: "2026-04-06T10:00:00.000Z",
        unit: { id: "unit-1", label: "A-1204" },
        requesterContext: {
            isResident: true,
            residentOccupancyStatus: "ACTIVE",
            residentInviteStatus: "ACCEPTED",
            isFormerResident: false,
            currentUnitOccupiedByRequester: true,
            currentUnitOccupant: {
                userId: "resident-1",
                name: "Resident User",
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
        ownerApproval: { status: "PENDING" },
    },
];

const ownerConversations = {
    items: [
        {
            id: "conversation-1",
            subject: "Maintenance follow-up",
            orgId: "org-1",
            orgName: "TowerDesk Management",
            buildingId: "building-1",
            buildingName: "Central Tower",
            unreadCount: 2,
            participants: [],
            messages: [
                {
                    id: "message-1",
                    content: "We are scheduling the vendor visit.",
                    sender: { id: "user-1", name: "Building Manager" },
                    createdAt: "2026-04-06T12:00:00.000Z",
                },
            ],
            createdAt: "2026-04-06T12:00:00.000Z",
            updatedAt: "2026-04-06T12:00:00.000Z",
        },
    ],
    nextCursor: null,
};

const ownerNotifications = {
    items: [
        {
            id: "notification-1",
            type: "OWNER_APPROVAL_REQUESTED",
            title: "Approval required",
            body: "A maintenance request requires your approval.",
            data: {
                requestId: "request-1",
                buildingId: "building-1",
            },
            readAt: null,
            dismissedAt: null,
            createdAt: "2026-04-06T12:30:00.000Z",
        },
        {
            id: "notification-2",
            type: "BROADCAST_SENT",
            title: "Community update",
            body: "New portfolio-wide update available.",
            data: {
                broadcastId: "broadcast-1",
                buildingIds: ["building-1", "building-2"],
                senderUserId: "user-1",
                metadata: {
                    audiences: ["tenants"],
                    scope: "multi_building",
                    buildingCount: 2,
                    audienceSummary: "Tenants",
                },
            },
            readAt: null,
            dismissedAt: null,
            createdAt: "2026-04-06T13:00:00.000Z",
        },
    ],
    nextCursor: null,
};

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/queries", () => ({
    useOwnerPortfolioSummary: () => ({
        data: { unitCount: 3, orgCount: 2, buildingCount: 2 },
        isLoading: false,
    }),
    useOwnerPortfolioUnits: () => ({
        data: [
            {
                unitId: "unit-1",
                unitLabel: "A-1204",
                orgId: "org-1",
                orgName: "TowerDesk Management",
                buildingId: "building-1",
                buildingName: "Central Tower",
            },
        ],
        isLoading: false,
    }),
    useOwnerPortfolioRequests: () => ({
        data: ownerRequests,
        isLoading: false,
    }),
    useOwnerPortfolioRequest: () => ({
        data: ownerRequests[0],
        isLoading: false,
    }),
    useOwnerRequestCommentUnreadCount: () => ({
        data: 4,
        isLoading: false,
    }),
    useOwnerRequestComments: () => ({
        data: [
            {
                id: "comment-1",
                commentText: "Please review the estimate.",
                createdAt: "2026-04-06T11:00:00.000Z",
                user: { userId: "user-1", fullName: "Operations Admin" },
            },
        ],
        isLoading: false,
        isFetching: false,
    }),
    useApproveOwnerRequest: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useRejectOwnerRequest: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useAddOwnerRequestComment: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useOwnerConversations: () => ({
        data: ownerConversations,
        isLoading: false,
    }),
    useOwnerConversationUnreadCount: () => ({
        data: 2,
        isLoading: false,
    }),
    useOwnerConversation: () => ({
        data: ownerConversations.items[0],
        isLoading: false,
    }),
    useCreateOwnerManagementConversation: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useCreateOwnerTenantConversation: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useSendOwnerConversationMessage: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useMarkOwnerConversationRead: () => ({
        mutate: vi.fn(),
    }),
    useOwnerNotifications: () => ({
        data: ownerNotifications,
        isLoading: false,
    }),
    useOwnerNotificationUnreadCount: () => ({
        data: 5,
        isLoading: false,
    }),
    useMarkOwnerNotificationRead: () => ({
        isPending: false,
        mutate: vi.fn(),
    }),
    useMarkAllOwnerNotificationsRead: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useDismissOwnerNotification: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
    useUndismissOwnerNotification: () => ({
        isPending: false,
        mutateAsync: vi.fn(),
    }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, disabled, ...props }: any) =>
        createElement("button", { ...props, "data-disabled": disabled ? "true" : "false" }, children),
}));

vi.mock("@/components/ui/badge", () => ({
    Badge: ({ children, ...props }: any) => createElement("span", props, children),
}));

vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => createElement("input", props),
}));

vi.mock("@/components/ui/textarea", () => ({
    Textarea: (props: any) => createElement("textarea", props),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", { "data-slot": "select" }, children),
    SelectTrigger: ({ children }: any) => createElement("button", { "data-slot": "select-trigger" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, value }: any) => createElement("div", { "data-value": value }, children),
}));

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: any) => createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
    usePathname: () => "/portal/owner",
    useSearchParams: () => new URLSearchParams(),
}));

describe("owner portal pages", () => {
    beforeEach(() => {
        authState = { baseRole: "owner" };
    });

    it("renders the owner dashboard with portfolio totals", () => {
        const markup = renderToStaticMarkup(createElement(OwnerDashboardPage));

        expect(markup).toContain("Portfolio overview");
        expect(markup).toContain("Review requests");
        expect(markup).toContain("TowerDesk Management");
    });

    it("renders the owner requests page with approval actions", () => {
        const markup = renderToStaticMarkup(createElement(OwnerRequestsPage));

        expect(markup).toContain("Owner requests");
        expect(markup).toContain("Water leakage");
        expect(markup).toContain("Approve");
        expect(markup).toContain("Tenancy Context");
        expect(markup).toContain("Current Cycle");
        expect(markup).toContain("Historical");
        expect(markup).toContain("Legacy Context");
        expect(markup).toContain("All Cycles");
        expect(markup).toContain("Active Resident");
        expect(markup).toContain("Current Occupancy");
        expect(markup).toContain("Current Lease");
        expect(markup).toContain("Resolved from history");
        expect(markup).toContain("Post comment");
    });

    it("renders the owner messages page with composer and thread details", () => {
        const markup = renderToStaticMarkup(createElement(OwnerMessagesPage));

        expect(markup).toContain("Owner messages");
        expect(markup).toContain("Maintenance follow-up");
        expect(markup).toContain("Create conversation");
        expect(markup).toContain("Send message");
    });

    it("renders the owner notifications page with list actions", () => {
        const markup = renderToStaticMarkup(createElement(OwnerNotificationsPage));

        expect(markup).toContain("Owner notifications");
        expect(markup).toContain("Approval required");
        expect(markup).toContain("Mark all read");
        expect(markup).toContain("Dismiss");
        expect(markup).toContain("Community update");
        expect(markup).toContain("Tenants");
        expect(markup).toContain("Multi-building");
        expect(markup).toContain("2 buildings");
    });
});
