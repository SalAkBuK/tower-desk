import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadConversationApis() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    const [communicationsApi, ownerPortalApi] = await Promise.all([
        import("../../src/lib/api/communications"),
        import("../../src/lib/api/ownerPortal"),
    ]);
    return { communicationsApi, ownerPortalApi };
}

describe("conversation api filters", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("sends org conversation type and counterparty filters", async () => {
        const { communicationsApi } = await loadConversationApis();
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));

            expect(url.pathname).toBe("/api/org/conversations");
            expect(url.searchParams.get("limit")).toBe("25");
            expect(url.searchParams.get("cursor")).toBe("cursor-1");
            expect(url.searchParams.get("type")).toBe("MANAGEMENT_OWNER");
            expect(url.searchParams.get("counterpartyGroup")).toBe("OWNER");

            return new Response(JSON.stringify({ items: [], nextCursor: null }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        await communicationsApi.getConversations({
            limit: 25,
            cursor: "cursor-1",
            type: "MANAGEMENT_OWNER",
            counterpartyGroup: "OWNER",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("sends owner conversation type and counterparty filters", async () => {
        const { ownerPortalApi } = await loadConversationApis();
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));

            expect(url.pathname).toBe("/api/owner/conversations");
            expect(url.searchParams.get("limit")).toBe("10");
            expect(url.searchParams.get("cursor")).toBe("cursor-2");
            expect(url.searchParams.get("type")).toBe("OWNER_TENANT");
            expect(url.searchParams.get("counterpartyGroup")).toBe("MIXED");

            return new Response(JSON.stringify({ items: [], nextCursor: null }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        await ownerPortalApi.getOwnerConversations({
            limit: 10,
            cursor: "cursor-2",
            type: "OWNER_TENANT",
            counterpartyGroup: "MIXED",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
