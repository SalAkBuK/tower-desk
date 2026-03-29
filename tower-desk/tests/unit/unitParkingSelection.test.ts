import { describe, expect, it } from "vitest";
import type { ParkingAllocation, ParkingSlot } from "../../src/lib/types";
import {
    areParkingSlotSelectionsEqual,
    buildNormalizedUnitParkingSlots,
    getUnitAllocationSlotIds,
} from "../../src/components/buildings/unitParkingSelection";

const vacantSlot = (overrides: Partial<ParkingSlot> = {}): ParkingSlot => ({
    id: "slot-1",
    buildingId: "building-1",
    code: "A-01",
    level: "B1",
    type: "CAR",
    isCovered: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
});

const allocation = (overrides: Partial<ParkingAllocation> = {}): ParkingAllocation => ({
    id: "allocation-1",
    buildingId: "building-1",
    unitId: "unit-1",
    occupancyId: null,
    parkingSlotId: "slot-1",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    slot: {
        id: "slot-1",
        code: "A-01",
        level: "B1",
        type: "CAR",
    },
    ...overrides,
});

describe("buildNormalizedUnitParkingSlots", () => {
    it("keeps active vacant slots sorted for create flows", () => {
        const result = buildNormalizedUnitParkingSlots({
            buildingId: "building-1",
            vacantSlots: [
                vacantSlot({ id: "slot-2", code: "B-02" }),
                vacantSlot({ id: "slot-1", code: "A-01" }),
                vacantSlot({ id: "slot-3", code: "C-03", isActive: false }),
            ],
            allocations: [],
        });

        expect(result.slots.map((slot) => slot.id)).toEqual(["slot-1", "slot-2"]);
        expect(result.allocatedSlots).toEqual([]);
        expect(Array.from(result.currentAllocationSlotIds)).toEqual([]);
    });

    it("merges current unit allocations into the selectable list for edit flows", () => {
        const result = buildNormalizedUnitParkingSlots({
            buildingId: "building-1",
            vacantSlots: [vacantSlot({ id: "slot-2", code: "B-02" })],
            allocations: [
                allocation({
                    id: "allocation-2",
                    parkingSlotId: "slot-1",
                    slot: {
                        id: "slot-1",
                        code: "A-01",
                        level: "B2",
                        type: "EV",
                    },
                }),
            ],
        });

        expect(result.slots.map((slot) => [slot.id, slot.isAllocatedToUnit])).toEqual([
            ["slot-1", true],
            ["slot-2", false],
        ]);
        expect(result.allocatedSlots.map((slot) => slot.id)).toEqual(["slot-1"]);
        expect(Array.from(result.currentAllocationSlotIds)).toEqual(["slot-1"]);
    });
});

describe("parking selection helpers", () => {
    it("collects unique slot ids from unit allocations", () => {
        expect(Array.from(getUnitAllocationSlotIds([
            allocation({ id: "allocation-1", parkingSlotId: "slot-1" }),
            allocation({ id: "allocation-2", parkingSlotId: "slot-1" }),
            allocation({ id: "allocation-3", parkingSlotId: "slot-3", slot: { id: "slot-3", code: "C-03", level: null, type: "BIKE" } }),
        ]))).toEqual(["slot-1", "slot-3"]);
    });

    it("compares selections independent of order", () => {
        expect(areParkingSlotSelectionsEqual(["slot-2", "slot-1"], ["slot-1", "slot-2"])).toBe(true);
        expect(areParkingSlotSelectionsEqual(["slot-1"], ["slot-1", "slot-2"])).toBe(false);
    });
});
