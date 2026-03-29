import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn((options) => options),
    useMutation: vi.fn((options) => options),
    useQueryClient: vi.fn(() => ({
        invalidateQueries,
    })),
}));

process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3001/api";

const barrelQueries = await import("../../src/lib/queries");
const contractQueries = await import("../../src/lib/queries/contracts");
const parkingQueries = await import("../../src/lib/queries/parking");
const residentQueries = await import("../../src/lib/queries/residents");

describe("queries barrel exports", () => {
    it("re-exports representative domain hooks by reference", () => {
        expect(barrelQueries.useParkingSlots).toBe(parkingQueries.useParkingSlots);
        expect(barrelQueries.useCreateParkingAllocations).toBe(parkingQueries.useCreateParkingAllocations);
        expect(barrelQueries.useOrgLeases).toBe(contractQueries.useOrgLeases);
        expect(barrelQueries.useBuildingOccupanciesDto).toBe(residentQueries.useBuildingOccupanciesDto);
    });
});

describe("representative query hooks", () => {
    beforeEach(() => {
        invalidateQueries.mockClear();
    });

    it("keeps parking slot query keys intact", () => {
        const query = parkingQueries.useParkingSlots("building-1", { available: true, enabled: true }) as any;

        expect(query.queryKey).toEqual(["parking-slots", "building-1", true]);
    });

    it("keeps parking allocation invalidations intact", () => {
        const mutation = parkingQueries.useCreateParkingAllocations() as any;

        mutation.onSuccess?.(
            undefined,
            {
                buildingId: "building-1",
                leaseId: "lease-1",
                data: {
                    occupancyId: "occupancy-1",
                    unitId: "unit-1",
                    slotIds: ["slot-1"],
                },
            },
            undefined
        );

        expect(invalidateQueries.mock.calls.map(([arg]) => arg)).toEqual([
            { queryKey: ["parking-slots", "building-1"] },
            { queryKey: ["parking-slot-unit-labels", "building-1"] },
            { queryKey: ["occupancy-parking-allocations", "occupancy-1"] },
            { queryKey: ["unit-parking-allocations", "unit-1"] },
            { queryKey: ["lease-timeline", "lease-1"] },
            { queryKey: ["leases", "byId", "lease-1"] },
        ]);
    });

    it("keeps org leases query keys intact", () => {
        const query = contractQueries.useOrgLeases({ buildingId: "building-1", status: "ACTIVE" }, { enabled: true }) as any;

        expect(query.queryKey).toEqual(["org-leases", { buildingId: "building-1", status: "ACTIVE" }]);
    });

    it("keeps contract creation invalidations intact", () => {
        const mutation = contractQueries.useCreateContract() as any;

        mutation.onSuccess?.(
            { id: "contract-1" },
            {
                buildingId: "building-1",
                dto: {
                    residentUserId: "resident-1",
                    unitId: "unit-1",
                },
            },
            undefined
        );

        expect(invalidateQueries.mock.calls.map(([arg]) => arg)).toEqual([
            { queryKey: ["org-leases"] },
            { queryKey: ["leases", "byId", "contract-1"] },
            { queryKey: ["resident-directory", "building-1"] },
            { queryKey: ["building-units", "building-1"] },
        ]);
    });
});
