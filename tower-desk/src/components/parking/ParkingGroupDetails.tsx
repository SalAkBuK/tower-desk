"use client";

import type { ReactNode } from "react";
import { Car, Bike, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParkingSlot, ParkingSlotType } from "@/lib/types";
import type { ParkingGroupDetailsData, ParkingGroupMode, ParkingGroupSlotEntry } from "./parkingGroups.types";

const slotTypeIcon: Record<ParkingSlotType, ReactNode> = {
    CAR: <Car className="h-4 w-4" />,
    BIKE: <Bike className="h-4 w-4" />,
    EV: <Zap className="h-4 w-4" />,
};

interface ParkingGroupDetailsProps {
    mode: ParkingGroupMode;
    details?: ParkingGroupDetailsData;
    isLoading: boolean;
    error?: Error | null;
    onRetry: () => void;
    onAllocate: () => void;
    onEditSlot: (slot: ParkingSlot) => void;
    onManageAllocations: (occupancyId: string, label?: string) => void;
    onToggleActive: (slot: ParkingSlot) => void;
    slotById: Map<string, ParkingSlot>;
    isUpdating?: boolean;
}

function resolveSlot(slotById: Map<string, ParkingSlot>, entry: ParkingGroupSlotEntry) {
    const slotId = entry.allocation.slot?.id || entry.allocation.parkingSlotId;
    if (!slotId) return null;
    return slotById.get(slotId) ?? null;
}

export function ParkingGroupDetails({
    mode,
    details,
    isLoading,
    error,
    onRetry,
    onAllocate,
    onEditSlot,
    onManageAllocations,
    onToggleActive,
    slotById,
    isUpdating,
}: ParkingGroupDetailsProps) {
    if (isLoading) {
        return (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-52" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-dashed border-red-200 bg-red-50/60 p-4 text-sm text-red-700">
                <div>Failed to load group details.</div>
                <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
                    Retry
                </Button>
            </div>
        );
    }

    if (!details) {
        return (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-500">
                No details available.
            </div>
        );
    }

    const renderSlotRow = (entry: ParkingGroupSlotEntry) => {
        const allocation = entry.allocation;
        const slotId = allocation.slot?.id || allocation.parkingSlotId;
        const slot = resolveSlot(slotById, entry);
        const slotLabel = allocation.slot?.code || slot?.code || "Slot";
        const slotLevel = allocation.slot?.level || slot?.level || "No level";
        const slotType = allocation.slot?.type || slot?.type || "CAR";
        const occupancyLabel = entry.occupancy?.residentName || entry.occupancy?.residentEmail;
        const unitLabel = entry.occupancy?.unitLabel;

        return (
            <div key={allocation.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                            {slotTypeIcon[slotType]}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-900">{slotLabel}</div>
                            <div className="text-xs text-zinc-500">
                                {slotLevel} - {slotType}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => slot && onEditSlot(slot)}
                            disabled={!slot}
                        >
                            Edit
                        </Button>
                        {entry.occupancy?.id ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    onManageAllocations(
                                        entry.occupancy?.id,
                                        unitLabel && occupancyLabel ? `${unitLabel} - ${occupancyLabel}` : occupancyLabel
                                    )
                                }
                            >
                                Manage
                            </Button>
                        ) : null}
                        {slot ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleActive(slot)}
                                disabled={isUpdating}
                            >
                                {slot.isActive ? "Deactivate" : "Activate"}
                            </Button>
                        ) : null}
                    </div>
                </div>
                {occupancyLabel ? (
                    <div className="mt-2 text-xs text-zinc-500">
                        Assigned to {occupancyLabel} {unitLabel ? `- ${unitLabel}` : ""}
                    </div>
                ) : null}
                {!slot?.isActive ? (
                    <Badge variant="destructive" className="mt-2">
                        Inactive
                    </Badge>
                ) : null}
            </div>
        );
    };

    return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {mode === "unit" ? "Unit details" : "Resident details"}
                </div>
                <Button size="sm" variant="outline" onClick={onAllocate}>
                    Allocate slot
                </Button>
            </div>

            {mode === "unit" ? (
                <div className="mt-3 space-y-4">
                    <div>
                        <div className="text-xs font-semibold text-zinc-600">Residents</div>
                        {details.residents && details.residents.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {details.residents.map((resident) => (
                                    <Badge key={resident.id} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                        {resident.residentName || resident.residentEmail || "Resident"}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-2 text-xs text-zinc-500">Vacant</div>
                        )}
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-zinc-600">Allocated slots</div>
                        {details.slots && details.slots.length > 0 ? (
                            <div className="mt-2 space-y-2">{details.slots.map(renderSlotRow)}</div>
                        ) : (
                            <div className="mt-2 text-xs text-zinc-500">No allocated slots.</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mt-3 space-y-4">
                    {details.units && details.units.length > 0 ? (
                        details.units.map((unit) => (
                            <div key={unit.unitId || unit.unitLabel} className="rounded-lg border border-zinc-200 bg-white p-3">
                                <div className="text-xs font-semibold text-zinc-600">Unit {unit.unitLabel}</div>
                                {unit.slots.length > 0 ? (
                                    <div className="mt-2 space-y-2">{unit.slots.map(renderSlotRow)}</div>
                                ) : (
                                    <div className="mt-2 text-xs text-zinc-500">No allocated slots.</div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-zinc-500">No units found.</div>
                    )}
                </div>
            )}
        </div>
    );
}
