import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadApis() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    const [requestsApi, visitorsApi, auth] = await Promise.all([
        import("../../src/lib/api/requests"),
        import("../../src/lib/api/visitors"),
        import("../../src/lib/auth"),
    ]);
    auth.useAuthStore.setState({
        token: null,
        refreshToken: null,
        user: null,
        selectedOrgId: null,
        selectedBuildingId: null,
    });
    return { requestsApi, visitorsApi };
}

describe("requests and visitors pagination", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("sends limit=50 and follows cursors for building maintenance requests", async () => {
        const { requestsApi } = await loadApis();
        const seenUrls: string[] = [];

        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            seenUrls.push(`${url.pathname}?${url.searchParams.toString()}`);

            expect(url.pathname).toBe("/api/org/buildings/building-1/requests");
            expect(url.searchParams.get("limit")).toBe("50");
            expect(url.searchParams.get("status")).toBe("OPEN");

            if (!url.searchParams.get("cursor")) {
                return new Response(JSON.stringify({
                    data: [{ id: "request-1", title: "Leak", status: "OPEN", priority: "HIGH", buildingId: "building-1" }],
                    nextCursor: "cursor-1",
                    totalCount: 2,
                    limit: 50,
                }), { status: 200, headers: { "content-type": "application/json" } });
            }

            expect(url.searchParams.get("cursor")).toBe("cursor-1");
            return new Response(JSON.stringify({
                data: [{ id: "request-2", title: "Door", status: "OPEN", priority: "LOW", buildingId: "building-1" }],
                nextCursor: null,
                totalCount: 2,
                limit: 50,
            }), { status: 200, headers: { "content-type": "application/json" } });
        }));

        const requests = await requestsApi.getRequests("building-1", { status: "OPEN" });

        expect(requests.map((request) => request.id)).toEqual(["request-1", "request-2"]);
        expect(seenUrls).toEqual([
            "/api/org/buildings/building-1/requests?limit=50&status=OPEN",
            "/api/org/buildings/building-1/requests?limit=50&cursor=cursor-1&status=OPEN",
        ]);
    });

    it("maps assignedStaff from the management request list payload", async () => {
        const { requestsApi } = await loadApis();

        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
            data: [{
                id: "1f3db1b4-83df-42eb-a086-6ff396a20ee9",
                orgId: "c64866ae-5c89-4244-a777-d37d8bda0f66",
                title: "Balcony door lock issue",
                descriptionSummary: "The balcony sliding door lock is loose and does not close properly.",
                status: "IN_PROGRESS",
                priority: "NORMAL",
                building: {
                    id: "6f68d7fb-1611-455d-b30a-45c0a5ebb79d",
                    name: "Malik Heights 1",
                },
                unit: {
                    id: "6b25216f-d588-4932-916d-065a6d5aa542",
                    label: "A-304",
                    floor: 3,
                },
                assignedStaff: {
                    id: "4f0b0345-5e78-41c5-99d6-744231891696",
                    name: "Kamran Ali",
                    email: "kamran.ali.electrician@towerdeskpro.com",
                },
                serviceProvider: null,
                providerAssignedStaff: null,
                createdAt: "2026-05-09T14:44:15.000Z",
                updatedAt: "2026-05-25T15:44:15.000Z",
                ownerApprovalStatus: "NOT_REQUIRED",
                queue: "OVERDUE",
                requestTenancyContext: {
                    label: "CURRENT_OCCUPANCY",
                    leaseLabel: "CURRENT_LEASE",
                },
            }],
            nextCursor: null,
            totalCount: 1,
            limit: 50,
        }), { status: 200, headers: { "content-type": "application/json" } })));

        const [request] = await requestsApi.getRequests("6f68d7fb-1611-455d-b30a-45c0a5ebb79d");

        expect(request).toMatchObject({
            id: "1f3db1b4-83df-42eb-a086-6ff396a20ee9",
            description: "The balcony sliding door lock is loose and does not close properly.",
            buildingId: "6f68d7fb-1611-455d-b30a-45c0a5ebb79d",
            buildingName: "Malik Heights 1",
            assignedEmployeeId: "4f0b0345-5e78-41c5-99d6-744231891696",
            assignedTo: {
                id: "4f0b0345-5e78-41c5-99d6-744231891696",
                fullName: "Kamran Ali",
                email: "kamran.ali.electrician@towerdeskpro.com",
            },
        });
    });

    it("sends limit=50 and follows cursors for building visitors", async () => {
        const { visitorsApi } = await loadApis();
        const seenUrls: string[] = [];

        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            seenUrls.push(`${url.pathname}?${url.searchParams.toString()}`);

            expect(url.pathname).toBe("/api/org/buildings/building-1/visitors");
            expect(url.searchParams.get("limit")).toBe("50");
            expect(url.searchParams.get("status")).toBe("EXPECTED");
            expect(url.searchParams.get("unitId")).toBe("unit-1");

            if (!url.searchParams.get("cursor")) {
                return new Response(JSON.stringify({
                    data: [{ id: "visitor-1", buildingId: "building-1", visitorName: "Jane", status: "EXPECTED" }],
                    nextCursor: "cursor-1",
                    totalCount: 2,
                    limit: 50,
                }), { status: 200, headers: { "content-type": "application/json" } });
            }

            expect(url.searchParams.get("cursor")).toBe("cursor-1");
            return new Response(JSON.stringify({
                data: [{ id: "visitor-2", buildingId: "building-1", visitorName: "Omar", status: "EXPECTED" }],
                nextCursor: null,
                totalCount: 2,
                limit: 50,
            }), { status: 200, headers: { "content-type": "application/json" } });
        }));

        const visitors = await visitorsApi.getVisitors("building-1", { status: "EXPECTED", unitId: "unit-1" });

        expect(visitors.map((visitor) => visitor.id)).toEqual(["visitor-1", "visitor-2"]);
        expect(seenUrls).toEqual([
            "/api/org/buildings/building-1/visitors?limit=50&status=EXPECTED&unitId=unit-1",
            "/api/org/buildings/building-1/visitors?limit=50&status=EXPECTED&unitId=unit-1&cursor=cursor-1",
        ]);
    });
});
