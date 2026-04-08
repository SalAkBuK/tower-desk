import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadProviderRequestsApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/providerRequests");
}

describe("provider requests api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("maps provider request list, detail, comments, and unread count", async () => {
        const providerRequestsApi = await loadProviderRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith("/provider/requests/comments/unread-count")) {
                return new Response(JSON.stringify({ unreadCount: 3 }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1/comments")) {
                return new Response(JSON.stringify([
                    {
                        id: "comment-1",
                        message: "We are onsite now.",
                        visibility: "SHARED",
                        createdAt: "2026-04-07T09:30:00.000Z",
                        author: {
                            id: "worker-1",
                            name: "Vendor Worker",
                            email: "worker@rapidfix.test",
                        },
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1")) {
                return new Response(JSON.stringify({
                    request: {
                        id: "request-1",
                        buildingId: "building-1",
                        buildingName: "Central Tower",
                        title: "Water leakage",
                        description: "Kitchen sink is leaking",
                        status: "IN_PROGRESS",
                        priority: "HIGH",
                        type: "PLUMBING",
                        createdAt: "2026-04-07T08:00:00.000Z",
                        updatedAt: "2026-04-07T09:00:00.000Z",
                        createdBy: {
                            id: "resident-1",
                            name: "Resident User",
                            email: "resident@example.com",
                        },
                        unit: {
                            id: "unit-1",
                            label: "A-1204",
                            floor: 12,
                        },
                        serviceProvider: {
                            id: "provider-1",
                            name: "RapidFix Technical Services",
                            serviceCategory: "Plumbing",
                        },
                        serviceProviderAssignedTo: {
                            id: "worker-1",
                            name: "Vendor Worker",
                            email: "worker@rapidfix.test",
                        },
                        availableWorkers: [
                            {
                                userId: "worker-1",
                                name: "Vendor Worker",
                                email: "worker@rapidfix.test",
                                role: "WORKER",
                                membershipIsActive: true,
                                userIsActive: true,
                            },
                        ],
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests")) {
                return new Response(JSON.stringify([
                    {
                        id: "request-1",
                        buildingId: "building-1",
                        buildingName: "Central Tower",
                        title: "Water leakage",
                        description: "Kitchen sink is leaking",
                        status: "IN_PROGRESS",
                        priority: "HIGH",
                        serviceProviderAssignedTo: {
                            id: "worker-1",
                            name: "Vendor Worker",
                        },
                    },
                ]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const unreadCount = await providerRequestsApi.getProviderRequestUnreadCount();
        const requests = await providerRequestsApi.getProviderRequests();
        const request = await providerRequestsApi.getProviderRequest("request-1");
        const comments = await providerRequestsApi.getProviderRequestComments("request-1");

        expect(unreadCount).toBe(3);
        expect(requests[0]).toMatchObject({
            id: "request-1",
            buildingName: "Central Tower",
            status: "in-progress",
            serviceProviderAssignedTo: {
                id: "worker-1",
                name: "Vendor Worker",
            },
        });
        expect(request).toMatchObject({
            id: "request-1",
            type: "PLUMBING",
            serviceProvider: {
                id: "provider-1",
                name: "RapidFix Technical Services",
            },
            availableWorkers: [
                {
                    userId: "worker-1",
                    role: "WORKER",
                },
            ],
        });
        expect(comments[0]).toMatchObject({
            id: "comment-1",
            commentText: "We are onsite now.",
            visibility: "SHARED",
            user: {
                userId: "worker-1",
                fullName: "Vendor Worker",
            },
        });
    });

    it("sends provider manager mutations to the expected endpoints", async () => {
        const providerRequestsApi = await loadProviderRequestsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;

            if (url.endsWith("/provider/requests/request-1/assign-worker")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ userId: "worker-2" });
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1/status")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({ status: "COMPLETED" });
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1/comments")) {
                if (init?.method === "POST") {
                    expect(body).toEqual({ message: "Leak repaired" });
                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    });
                }
                return new Response(JSON.stringify([]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1/attachments")) {
                expect(init?.method).toBe("POST");
                expect(body).toEqual({
                    attachments: [
                        {
                            fileName: "before.jpg",
                            mimeType: "image/jpeg",
                            sizeBytes: 128,
                            url: "https://cdn.example.test/before.jpg",
                        },
                    ],
                });
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.endsWith("/provider/requests/request-1")) {
                return new Response(JSON.stringify({
                    request: {
                        id: "request-1",
                        status: "COMPLETED",
                        priority: "HIGH",
                        title: "Water leakage",
                        description: "Kitchen sink is leaking",
                        buildingId: "building-1",
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            throw new Error(`Unexpected URL ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        await providerRequestsApi.assignProviderRequestWorker("request-1", "worker-2");
        await providerRequestsApi.updateProviderRequestStatus("request-1", "completed");
        await providerRequestsApi.addProviderRequestComment("request-1", "Leak repaired");
        await providerRequestsApi.addProviderRequestAttachments("request-1", [{
            fileName: "before.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 128,
            url: "https://cdn.example.test/before.jpg",
        }]);

        expect(fetchMock).toHaveBeenCalled();
    });
});
