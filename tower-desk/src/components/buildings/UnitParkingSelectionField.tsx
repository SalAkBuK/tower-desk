"use client";

import type { Dispatch, SetStateAction } from "react";
import { VirtualizedParkingSlotSelect } from "./VirtualizedParkingSlotSelect";
import type { NormalizedUnitParkingSlot } from "./unitParkingSelection";

interface UnitParkingSelectionFieldProps {
    slots: NormalizedUnitParkingSlot[];
    selectedSlotIds: string[];
    onSelectedSlotIdsChange: Dispatch<SetStateAction<string[]>>;
    currentAllocationSlotIds: Set<string>;
    isEditMode: boolean;
    isLoading?: boolean;
    error?: Error | null;
    disabled?: boolean;
}

export function UnitParkingSelectionField({
    slots,
    selectedSlotIds,
    onSelectedSlotIdsChange,
    currentAllocationSlotIds,
    isEditMode,
    isLoading = false,
    error = null,
    disabled = false,
}: UnitParkingSelectionFieldProps) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-zinc-900">{isEditMode ? "Parking Slots" : "Vacant Parking Slots"}</p>
                    <p className="text-xs text-zinc-500">
                        {isEditMode ? "Allocated slots are preselected. Adjust the selection to update this unit." : "Select available slots to include for this unit."}
                    </p>
                </div>
                <div className="text-xs text-zinc-500">{selectedSlotIds.length} selected</div>
            </div>

            <VirtualizedParkingSlotSelect
                slots={slots}
                selectedIds={selectedSlotIds}
                onSelectedIdsChange={onSelectedSlotIdsChange}
                isEditMode={isEditMode}
                currentUnitAllocationSlotIds={currentAllocationSlotIds}
                isLoading={isLoading}
                error={error}
                disabled={disabled}
            />
        </div>
    );
}
