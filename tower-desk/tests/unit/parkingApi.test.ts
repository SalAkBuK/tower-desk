import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadParkingApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    const parking = await import("../../src/lib/api/parking");
    const auth = await import("../../src/lib/auth");
    return { parking, useAuthStore: auth.useAuthStore };
}

describe("parking api", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("parses unit parking allocations from nested parkingAllocations payloads", async () => {
        const { parking, useAuthStore } = await loadParkingApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url !== `${API_BASE_URL}/org/units/unit-1/parking-allocations?limit=50`) {
                throw new Error(`Unexpected fetch URL: ${url}`);
            }

            return new Response(JSON.stringify({
                data: {
                    parkingAllocations: [
                        {
                            id: "alloc-1",
                            buildingId: "building-1",
                            unitId: "unit-1",
                            slotId: "slot-7",
                            parkingSlot: {
                                id: "slot-7",
                                code: "B-07",
                                level: "P2",
                                type: "CAR",
                            },
                        },
                    ],
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        }));

        await expect(parking.getUnitParkingAllocations("unit-1")).resolves.toEqual([
            expect.objectContaining({
                id: "alloc-1",
                buildingId: "building-1",
                unitId: "unit-1",
                parkingSlotId: "slot-7",
                slot: expect.objectContaining({
                    id: "slot-7",
                    code: "B-07",
                    level: "P2",
                    type: "CAR",
                }),
            }),
        ]);
    });

    it("parses occupancy parking allocations from parkingAllocations lists", async () => {
        const { parking, useAuthStore } = await loadParkingApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url !== `${API_BASE_URL}/org/occupancies/occ-1/parking-allocations?limit=50&active=true`) {
                throw new Error(`Unexpected fetch URL: ${url}`);
            }

            return new Response(JSON.stringify({
                parkingAllocations: [
                    {
                        id: "alloc-2",
                        occupancyId: "occ-1",
                        parkingSlotId: "slot-8",
                        slotCode: "C-08",
                        level: "Ground",
                        type: "EV",
                    },
                ],
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        }));

        await expect(parking.getOccupancyParkingAllocations("occ-1", { active: true })).resolves.toEqual([
            expect.objectContaining({
                id: "alloc-2",
                occupancyId: "occ-1",
                parkingSlotId: "slot-8",
                slot: expect.objectContaining({
                    id: "slot-8",
                    code: "C-08",
                    level: "Ground",
                    type: "EV",
                }),
            }),
        ]);
    });
});
