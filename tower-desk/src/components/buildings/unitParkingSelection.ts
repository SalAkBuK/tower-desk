"use client";

import type { ParkingAllocation, ParkingSlot } from "@/lib/types";

export type NormalizedUnitParkingSlot = ParkingSlot & {
    allocationId?: string;
    isAllocatedToUnit: boolean;
};

const compareParkingSlots = (a: { code: string }, b: { code: string }) =>
    a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" });

const toFallbackSlot = (buildingId: string, allocation: ParkingAllocation): NormalizedUnitParkingSlot | null => {
    const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
    if (!slotId) return null;

    return {
        id: String(slotId),
        allocationId: allocation.id,
        buildingId,
        code: allocation.slot?.code ?? `Slot ${slotId}`,
        level: allocation.slot?.level ?? null,
        type: allocation.slot?.type ?? "CAR",
        isCovered: false,
        isActive: true,
        createdAt: "",
        isAllocatedToUnit: true,
    };
};

export const getUnitAllocationSlotIds = (allocations: ParkingAllocation[] | undefined) => {
    const ids = new Set<string>();
    (allocations || []).forEach((allocation) => {
        const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
        if (slotId) ids.add(String(slotId));
    });
    return ids;
};

export const areParkingSlotSelectionsEqual = (left: Iterable<string>, right: Iterable<string>) => {
    const leftSorted = Array.from(left).sort();
    const rightSorted = Array.from(right).sort();

    return leftSorted.length === rightSorted.length
        && leftSorted.every((value, index) => value === rightSorted[index]);
};

export const buildNormalizedUnitParkingSlots = ({
    buildingId,
    vacantSlots,
    allocations,
}: {
    buildingId: string;
    vacantSlots?: ParkingSlot[];
    allocations?: ParkingAllocation[];
}) => {
    const slotsById = new Map<string, NormalizedUnitParkingSlot>();

    (vacantSlots || [])
        .filter((slot) => slot.isActive !== false)
        .forEach((slot) => {
            slotsById.set(slot.id, {
                ...slot,
                isAllocatedToUnit: false,
            });
        });

    (allocations || []).forEach((allocation) => {
        const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
        if (!slotId) return;

        const existing = slotsById.get(String(slotId));
        const fallback = toFallbackSlot(buildingId, allocation);
        if (!fallback) return;

        slotsById.set(String(slotId), {
            ...(existing || fallback),
            ...fallback,
            isCovered: existing?.isCovered ?? fallback.isCovered,
            createdAt: existing?.createdAt ?? fallback.createdAt,
            isAllocatedToUnit: true,
        });
    });

    const slots = Array.from(slotsById.values()).sort(compareParkingSlots);
    const allocatedSlots = slots.filter((slot) => slot.isAllocatedToUnit);

    return {
        slots,
        allocatedSlots,
        currentAllocationSlotIds: getUnitAllocationSlotIds(allocations),
    };
};
