import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadResidentsApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/residents");
}

describe("residents api provisioning", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("moves resident occupancy with the canonical provision payload", async () => {
        const residentsApi = await loadResidentsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/users/provision`);

            const body = JSON.parse(String(init?.body ?? "{}"));
            expect(body).toMatchObject({
                identity: {
                    email: "resident@example.com",
                    name: "Resident User",
                },
                resident: {
                    buildingId: "building-uuid",
                    unitId: "unit-uuid",
                    mode: "MOVE",
                },
                mode: {
                    ifEmailExists: "LINK",
                    requireSameOrg: true,
                },
            });
            expect(body.grants).toBeUndefined();

            return new Response(JSON.stringify({
                user: {
                    id: "resident-user-uuid",
                    email: "resident@example.com",
                    name: "Resident User",
                },
                applied: {
                    resident: {
                        occupancyId: "occupancy-uuid",
                        buildingId: "building-uuid",
                        unitId: "unit-uuid",
                        status: "ACTIVE",
                        unit: {
                            id: "unit-uuid",
                            label: "Unit 101",
                        },
                    },
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const resident = await residentsApi.moveResidentOccupancy({
            buildingId: "building-uuid",
            residentUserId: "resident-user-uuid",
            residentEmail: "resident@example.com",
            residentName: "Resident User",
            unitId: "unit-uuid",
            mode: "MOVE",
        });

        expect(resident).toMatchObject({
            userId: "resident-user-uuid",
            name: "Resident User",
            email: "resident@example.com",
            unit: {
                id: "unit-uuid",
                label: "Unit 101",
            },
            status: "ACTIVE",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
