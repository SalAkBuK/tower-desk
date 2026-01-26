import type { BuildingOccupancy, ParkingAllocation } from "@/lib/types";

export type ParkingGroupMode = "unit" | "resident";

export type ParkingGroupSummary = {
    id: string;
    label: string;
    allocatedSlotsCount: number;
    residentsCount?: number;
    unitsCount?: number;
    isVacant?: boolean;
};

export type ParkingGroupSlotEntry = {
    allocation: ParkingAllocation;
    occupancy?: BuildingOccupancy;
};

export type ParkingGroupDetailsData = {
    id: string;
    mode: ParkingGroupMode;
    occupancy?: BuildingOccupancy;
    residents?: BuildingOccupancy[];
    slots?: ParkingGroupSlotEntry[];
    units?: {
        unitId?: string;
        unitLabel: string;
        slots: ParkingGroupSlotEntry[];
    }[];
};
