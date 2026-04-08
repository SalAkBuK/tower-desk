import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadOwnerPortalApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/ownerPortal");
}

describe("owner portal api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("maps owner portfolio, conversations, and notifications", async () => {
        const ownerPortalApi = await loadOwnerPortalApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith("/owner/portfolio/summary")) {
                return new Response(JSON.stringify({ unitCount: 3, orgCount: 2, buildingCount: 2 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/portfolio/units")) {
                return new Response(JSON.stringify([
                    {
                        orgId: "org-1",
                        orgName: "TowerDesk Management",
                        ownerId: "owner-1",
                        unitId: "unit-1",
                        buildingId: "building-1",
                        buildingName: "Central Tower",
                        unitLabel: "A-1204",
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/portfolio/requests/comments/unread-count")) {
                return new Response(JSON.stringify({ unreadCount: 4 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/portfolio/requests/request-1/comments")) {
                return new Response(JSON.stringify([
                    {
                        id: "comment-1",
                        message: "Please review the estimate.",
                        createdAt: "2026-04-06T11:00:00.000Z",
                        author: {
                            id: "user-1",
                            name: "Operations Admin",
                            email: "ops@example.com",
                        },
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/portfolio/requests/request-1")) {
                return new Response(JSON.stringify({
                    id: "request-1",
                    orgId: "org-1",
                    orgName: "TowerDesk Management",
                    buildingId: "building-1",
                    buildingName: "Central Tower",
                    title: "Water leakage",
                    description: "Kitchen sink is leaking",
                    status: "OPEN",
                    priority: "HIGH",
                    unit: { id: "unit-1", label: "A-1204" },
                    ownerApproval: { status: "PENDING", estimatedAmount: "450.00", estimatedCurrency: "AED" },
                    createdAt: "2026-04-06T10:00:00.000Z",
                    updatedAt: "2026-04-06T10:00:00.000Z",
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/portfolio/requests")) {
                return new Response(JSON.stringify([
                    {
                        id: "request-1",
                        orgId: "org-1",
                        orgName: "TowerDesk Management",
                        buildingId: "building-1",
                        buildingName: "Central Tower",
                        title: "Water leakage",
                        description: "Kitchen sink is leaking",
                        status: "OPEN",
                        priority: "HIGH",
                        unit: { id: "unit-1", label: "A-1204" },
                        ownerApproval: { status: "PENDING" },
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/conversations/unread-count")) {
                return new Response(JSON.stringify({ unreadCount: 2 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/conversations/conversation-1")) {
                return new Response(JSON.stringify({
                    id: "conversation-1",
                    subject: "Maintenance follow-up",
                    buildingId: "building-1",
                    buildingName: "Central Tower",
                    orgId: "org-1",
                    orgName: "TowerDesk Management",
                    unreadCount: 2,
                    messages: [
                        {
                            id: "message-1",
                            content: "We are scheduling the vendor visit.",
                            createdAt: "2026-04-06T12:00:00.000Z",
                            sender: {
                                id: "user-2",
                                name: "Building Manager",
                            },
                        },
                    ],
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/conversations")) {
                return new Response(JSON.stringify({
                    items: [
                        {
                            id: "conversation-1",
                            subject: "Maintenance follow-up",
                            buildingId: "building-1",
                            buildingName: "Central Tower",
                            orgId: "org-1",
                            orgName: "TowerDesk Management",
                            unreadCount: 2,
                            lastMessage: {
                                id: "message-1",
                                content: "We are scheduling the vendor visit.",
                                createdAt: "2026-04-06T12:00:00.000Z",
                                sender: {
                                    id: "user-2",
                                    name: "Building Manager",
                                },
                            },
                        },
                    ],
                    nextCursor: null,
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/notifications/unread-count")) {
                return new Response(JSON.stringify({ unreadCount: 5 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/owner/notifications")) {
                return new Response(JSON.stringify({
                    items: [
                        {
                            id: "notification-1",
                            type: "OWNER_APPROVAL_REQUESTED",
                            title: "Approval required",
                            body: "A maintenance request requires your approval.",
                            dismissedAt: null,
                            readAt: null,
                            createdAt: "2026-04-06T12:30:00.000Z",
                        },
                    ],
                    nextCursor: null,
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const summary = await ownerPortalApi.getOwnerPortfolioSummary();
        const units = await ownerPortalApi.getOwnerPortfolioUnits();
        const unreadComments = await ownerPortalApi.getOwnerRequestCommentUnreadCount();
        const requests = await ownerPortalApi.getOwnerPortfolioRequests();
        const request = await ownerPortalApi.getOwnerPortfolioRequest("request-1");
        const comments = await ownerPortalApi.getOwnerRequestComments("request-1");
        const unreadConversations = await ownerPortalApi.getOwnerConversationUnreadCount();
        const conversations = await ownerPortalApi.getOwnerConversations();
        const conversation = await ownerPortalApi.getOwnerConversationById("conversation-1");
        const unreadNotifications = await ownerPortalApi.getOwnerNotificationUnreadCount();
        const notifications = await ownerPortalApi.getOwnerNotifications();

        expect(summary).toEqual({ unitCount: 3, orgCount: 2, buildingCount: 2 });
        expect(units[0]).toMatchObject({ unitId: "unit-1", orgName: "TowerDesk Management", buildingName: "Central Tower" });
        expect(unreadComments).toBe(4);
        expect(requests[0]).toMatchObject({ id: "request-1", orgName: "TowerDesk Management", buildingName: "Central Tower" });
        expect(request).toMatchObject({ id: "request-1", ownerApproval: { status: "PENDING", estimatedCurrency: "AED" } });
        expect(comments[0]).toMatchObject({ id: "comment-1", commentText: "Please review the estimate." });
        expect(unreadConversations).toBe(2);
        expect(conversations.items[0]).toMatchObject({ id: "conversation-1", orgName: "TowerDesk Management", buildingName: "Central Tower" });
        expect(conversation).toMatchObject({ id: "conversation-1", messages: [{ id: "message-1", content: "We are scheduling the vendor visit." }] });
        expect(unreadNotifications).toBe(5);
        expect(notifications.items[0]).toMatchObject({ id: "notification-1", dismissedAt: null });
    });

    it("sends owner mutations to the expected endpoints", async () => {
        const ownerPortalApi = await loadOwnerPortalApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/owner/portfolio/requests/request-1/approve")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ approvalReason: "Approved. Proceed." });
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/portfolio/requests/request-1/reject")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ approvalReason: "Please get a second quote first." });
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/portfolio/requests/request-1/comments")) {
                if (init?.method === "POST") {
                    expect(body).toEqual({ message: "Please send photos first." });
                    return new Response(JSON.stringify({
                        id: "comment-2",
                        message: "Please send photos first.",
                        createdAt: "2026-04-06T11:30:00.000Z",
                    }), { status: 200, headers: { "content-type": "application/json" } });
                }
                return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/messages/management")) {
                expect(body).toEqual({
                    unitId: "unit-1",
                    subject: "Question about unit access",
                    message: "Can management confirm the inspection schedule?",
                });
                return new Response(JSON.stringify({
                    id: "conversation-1",
                    subject: "Question about unit access",
                }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/messages/tenants")) {
                expect(body).toEqual({
                    unitId: "unit-1",
                    tenantUserId: "tenant-1",
                    subject: "Maintenance coordination",
                    message: "Please confirm you are available tomorrow.",
                });
                return new Response(JSON.stringify({
                    id: "conversation-2",
                    subject: "Maintenance coordination",
                }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/conversations/conversation-1/messages")) {
                expect(body).toEqual({ content: "Please send me the latest update." });
                return new Response(JSON.stringify({
                    id: "message-2",
                    content: "Please send me the latest update.",
                    createdAt: "2026-04-06T12:10:00.000Z",
                }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/conversations/conversation-1/read")) {
                expect(init?.method).toBe("POST");
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/notifications/read-all")) {
                expect(init?.method).toBe("POST");
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/notifications/notification-1/read")) {
                expect(init?.method).toBe("POST");
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/notifications/notification-1/dismiss")) {
                expect(init?.method).toBe("POST");
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/notifications/notification-1/undismiss")) {
                expect(init?.method).toBe("POST");
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
            }
            if (url.endsWith("/owner/portfolio/requests/request-1")) {
                return new Response(JSON.stringify({
                    id: "request-1",
                    buildingId: "building-1",
                    title: "Water leakage",
                    description: "Kitchen sink is leaking",
                    status: "OPEN",
                    priority: "HIGH",
                }), { status: 200, headers: { "content-type": "application/json" } });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        await ownerPortalApi.approveOwnerRequest("request-1", { approvalReason: "Approved. Proceed." });
        await ownerPortalApi.rejectOwnerRequest("request-1", { approvalReason: "Please get a second quote first." });
        const comment = await ownerPortalApi.addOwnerRequestComment("request-1", { message: "Please send photos first." });
        const managementConversation = await ownerPortalApi.createOwnerManagementConversation({
            unitId: "unit-1",
            subject: "Question about unit access",
            message: "Can management confirm the inspection schedule?",
        });
        const tenantConversation = await ownerPortalApi.createOwnerTenantConversation({
            unitId: "unit-1",
            tenantUserId: "tenant-1",
            subject: "Maintenance coordination",
            message: "Please confirm you are available tomorrow.",
        });
        const message = await ownerPortalApi.sendOwnerConversationMessage("conversation-1", { content: "Please send me the latest update." });
        await ownerPortalApi.markOwnerConversationRead("conversation-1");
        await ownerPortalApi.markAllOwnerNotificationsRead();
        await ownerPortalApi.markOwnerNotificationRead("notification-1");
        await ownerPortalApi.dismissOwnerNotification("notification-1");
        await ownerPortalApi.undismissOwnerNotification("notification-1");

        expect(comment).toMatchObject({ id: "comment-2", commentText: "Please send photos first." });
        expect(managementConversation).toMatchObject({ id: "conversation-1", subject: "Question about unit access" });
        expect(tenantConversation).toMatchObject({ id: "conversation-2", subject: "Maintenance coordination" });
        expect(message).toMatchObject({ id: "message-2", content: "Please send me the latest update." });
    });
});
