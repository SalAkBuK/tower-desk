import { describe, expect, it } from "vitest";

import { getPathWithoutSearchParams } from "../../src/lib/searchParams";

describe("getPathWithoutSearchParams", () => {
    it("removes only the requested key while preserving the rest of the query string", () => {
        expect(
            getPathWithoutSearchParams(
                "/portal/requests",
                new URLSearchParams("buildingId=building-1&requestId=request-1&tab=open"),
                ["requestId"],
            )
        ).toBe("/portal/requests?buildingId=building-1&tab=open");
    });

    it("returns the bare pathname when the removed key was the last query param", () => {
        expect(
            getPathWithoutSearchParams(
                "/portal/messages",
                new URLSearchParams("conversationId=conversation-1"),
                ["conversationId"],
            )
        ).toBe("/portal/messages");
    });
});
