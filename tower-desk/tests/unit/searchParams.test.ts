import { describe, expect, it } from "vitest";

import {
    getPathWithSearchParam,
    getPathWithSearchParamUpdates,
    getPathWithoutSearchParams,
} from "../../src/lib/searchParams";

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

describe("getPathWithSearchParam", () => {
    it("sets one query param while preserving the rest of the query string", () => {
        expect(
            getPathWithSearchParam(
                "/portal/requests",
                new URLSearchParams("requestId=request-1&tab=open"),
                "buildingId",
                "building-1",
            )
        ).toBe("/portal/requests?requestId=request-1&tab=open&buildingId=building-1");
    });

    it("removes the query param when the next value is empty", () => {
        expect(
            getPathWithSearchParam(
                "/portal/requests",
                new URLSearchParams("buildingId=building-1&requestId=request-1"),
                "buildingId",
                null,
            )
        ).toBe("/portal/requests?requestId=request-1");
    });
});

describe("getPathWithSearchParamUpdates", () => {
    it("sets and removes query params in one URL update", () => {
        expect(
            getPathWithSearchParamUpdates(
                "/portal/requests",
                new URLSearchParams("buildingId=old-building&requestId=request-1&tab=open"),
                {
                    buildingId: "building-2",
                    requestId: null,
                },
            )
        ).toBe("/portal/requests?buildingId=building-2&tab=open");
    });
});
