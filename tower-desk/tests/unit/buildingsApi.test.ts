import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadBuildingsApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/buildings");
}

describe("buildings api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("creates buildings without removed floors or unitsCount fields", async () => {
        const buildingsApi = await loadBuildingsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/buildings`);
            expect(init?.method).toBe("POST");
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            expect(body).toEqual({
                name: "Tower One",
                city: "Dubai",
                emirate: "Dubai",
                country: "ARE",
                timezone: "Asia/Dubai",
            });
            expect(body).not.toHaveProperty("floors");
            expect(body).not.toHaveProperty("unitsCount");

            return new Response(JSON.stringify({
                id: "building-1",
                name: "Tower One",
                city: "Dubai",
                emirate: "Dubai",
                country: "ARE",
                timezone: "Asia/Dubai",
            }), {
                status: 201,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const building = await buildingsApi.createBuilding({
            name: "Tower One",
            city: "Dubai",
            emirate: "Dubai",
            country: "ARE",
            timezone: "Asia/Dubai",
        });

        expect(building).toMatchObject({
            id: "building-1",
            name: "Tower One",
            city: "Dubai",
            country: "ARE",
        });
    });

    it("patches building identity and location fields", async () => {
        const buildingsApi = await loadBuildingsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/buildings/building-1`);
            expect(init?.method).toBe("PATCH");
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            expect(body).toEqual({
                name: "Updated Tower",
                city: "Abu Dhabi",
                emirate: null,
                country: "ARE",
                timezone: "Asia/Dubai",
            });

            return new Response(JSON.stringify({
                id: "building-1",
                name: "Updated Tower",
                city: "Abu Dhabi",
                emirate: null,
                country: "ARE",
                timezone: "Asia/Dubai",
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const building = await buildingsApi.updateBuilding("building-1", {
            name: "Updated Tower",
            city: "Abu Dhabi",
            emirate: "",
            country: "are",
            timezone: "Asia/Dubai",
        });

        expect(building.name).toBe("Updated Tower");
        expect(building.city).toBe("Abu Dhabi");
    });
});
