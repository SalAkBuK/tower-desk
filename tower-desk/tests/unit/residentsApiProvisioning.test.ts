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

    it("normalizes org resident lease summaries to ENDED when cancellation has move-out markers", async () => {
        const residentsApi = await loadResidentsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/residents`);

            return new Response(JSON.stringify({
                items: [{
                    user: {
                        id: "resident-user-uuid",
                        email: "resident@example.com",
                        name: "Resident User",
                    },
                    residentStatus: "FORMER",
                    lastOccupancy: {
                        id: "occupancy-uuid",
                        endAt: "2026-04-01T00:00:00.000Z",
                    },
                    lastContract: {
                        id: "contract-uuid",
                        status: "CANCELLED",
                        contractPeriodFrom: "2026-01-01T00:00:00.000Z",
                        contractPeriodTo: "2026-12-31T23:59:59.000Z",
                    },
                }],
                nextCursor: null,
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await residentsApi.getOrgResidents();

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.lease?.status).toBe("ENDED");
    });

    it("normalizes resident directory lease summaries to ENDED when cancellation has move-out markers", async () => {
        const residentsApi = await loadResidentsApi();

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/buildings/building-uuid/resident-directory`);

            return new Response(JSON.stringify({
                items: [{
                    occupancyId: "occupancy-uuid",
                    residentUserId: "resident-user-uuid",
                    residentName: "Resident User",
                    residentEmail: "resident@example.com",
                    endedOccupancy: {
                        leaseId: "contract-uuid",
                        endAt: "2026-04-02T00:00:00.000Z",
                    },
                    lease: {
                        id: "contract-uuid",
                        status: "CANCELLED",
                        contractPeriodFrom: "2026-01-01T00:00:00.000Z",
                        contractPeriodTo: "2026-12-31T23:59:59.000Z",
                    },
                }],
                nextCursor: null,
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const result = await residentsApi.getResidentDirectory("building-uuid");

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.lease?.status).toBe("ENDED");
    });
});
