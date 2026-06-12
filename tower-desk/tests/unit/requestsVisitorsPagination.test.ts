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
