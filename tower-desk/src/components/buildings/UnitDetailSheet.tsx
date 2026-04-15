"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { SlideOver } from "@/components/common/SlideOver";
import { Checkbox } from "@/components/ui/checkbox";
import { useBuildingOccupancies, useBuildingResidents, useBuildingUnit, useCreateParkingAllocations, useEndAllParkingAllocations, useEndAllUnitParkingAllocations, useOwners, useParkingSlots, useUnitTypes } from "@/lib/queries";
import { getOccupancyParkingAllocations, getOccupancyVehicles } from "@/lib/api/parking";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { resolveUnitLeaseManagementHref } from "@/lib/leaseNavigation";
import { areParkingSlotSelectionsEqual, buildNormalizedUnitParkingSlots } from "./unitParkingSelection";

interface UnitDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    unitId: string | null;
    onEdit?: () => void;
}

const formatValue = (value?: string | number | boolean | null) => {
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
};

const formatMoney = (value?: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
};

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
};

const unitSizeUnitLabels: Record<string, string> = {
    SQ_FT: "sq ft",
};

export function UnitDetailSheet({ open, onOpenChange, buildingId, unitId, onEdit }: UnitDetailSheetProps) {
    const isEnabled = open && Boolean(unitId);
    const { data: unit, isLoading } = useBuildingUnit(buildingId, unitId || "", { enabled: isEnabled });
    const { data: unitTypes } = useUnitTypes({ enabled: isEnabled });
    const { data: owners } = useOwners({ enabled: isEnabled });
    const { data: residents } = useBuildingResidents(buildingId, { enabled: isEnabled });
    const { data: occupancies } = useBuildingOccupancies(buildingId, { enabled: isEnabled });
    const unitOccupancies = useMemo(() => {
        return (occupancies || []).filter((occ) => occ.unitId === unitId && (occ.status === "ACTIVE" || !occ.endAt));
    }, [occupancies, unitId]);
    const occupancyById = useMemo(() => {
        return new Map(unitOccupancies.map((occ) => [occ.id, occ]));
    }, [unitOccupancies]);
    const occupancyIds = useMemo(() => unitOccupancies.map((occ) => occ.id), [unitOccupancies]);
    const primaryOccupancy = useMemo(() => {
        return unitOccupancies.find((occ) => occ.status === "ACTIVE") ?? unitOccupancies[0];
    }, [unitOccupancies]);
    const { data: vacantSlotsRaw, isLoading: isVacantSlotsLoading, error: vacantSlotsError, refetch: refetchVacantSlots } = useParkingSlots(buildingId, {
        available: true,
        enabled: isEnabled && Boolean(buildingId),
    });
    const occupancyParkingAllocationQueries = useQueries({
        queries: occupancyIds.map((occupancyId) => ({
            queryKey: ["occupancy-parking-allocations", occupancyId, true],
            queryFn: () => getOccupancyParkingAllocations(occupancyId, { active: true }),
            enabled: isEnabled && Boolean(occupancyId),
            staleTime: 60_000,
        })),
    });
    const occupancyParkingAllocations = useMemo(
        () => occupancyParkingAllocationQueries.flatMap((query) => query.data || []),
        [occupancyParkingAllocationQueries]
    );
    const normalizedParking = useMemo(() => buildNormalizedUnitParkingSlots({
        buildingId,
        vacantSlots: vacantSlotsRaw || [],
        allocations: occupancyParkingAllocations,
    }), [buildingId, occupancyParkingAllocations, vacantSlotsRaw]);
    const isUnitParkingAllocationsLoading = occupancyParkingAllocationQueries.some((query) => query.isLoading);
    const hasUnitParkingAllocationsError = occupancyParkingAllocationQueries.some((query) => query.isError);
    const allocatedSlotsCount = normalizedParking.allocatedSlots.length;
    const hasAllocatedSlots = allocatedSlotsCount > 0;
    const allocateParkingSlots = useCreateParkingAllocations();
    const endAllOccupancyAllocations = useEndAllParkingAllocations();
    const endAllUnitAllocations = useEndAllUnitParkingAllocations();
    const [isEditingParking, setIsEditingParking] = useState(false);
    const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
    const [confirmEndAll, setConfirmEndAll] = useState(false);
    const leaseManagementHref = resolveUnitLeaseManagementHref({
        buildingId,
        query: unit?.label ?? unitId ?? "",
    });

    const unitTypeName = unit?.unitTypeId
        ? unitTypes?.find((type) => type.id === unit.unitTypeId)?.name
        : undefined;
    const owner = unit?.ownerId ? owners?.find((entry) => entry.id === unit.ownerId) : undefined;
    const unitResidents = residents?.filter((resident) => resident.unit?.id === unitId) ?? [];
    const shouldLoadVehicles = isEnabled && hasAllocatedSlots && occupancyIds.length > 0;
    const currentAllocationSlotIds = normalizedParking.currentAllocationSlotIds;

    useEffect(() => {
        if (!isEnabled || isEditingParking) return;
        setSelectedSlotIds((prev) => {
            const next = Array.from(currentAllocationSlotIds);
            if (areParkingSlotSelectionsEqual(prev, next)) {
                return prev;
            }
            return next;
        });
    }, [currentAllocationSlotIds, isEditingParking, isEnabled]);

    const isParkingSaving =
        allocateParkingSlots.isPending
        || endAllOccupancyAllocations.isPending
        || endAllUnitAllocations.isPending;

    const refreshParkingContext = async () => {
        await refetchVacantSlots();
        await Promise.all(occupancyParkingAllocationQueries.map((query) => query.refetch()));
    };

    const clearActiveParkingAllocations = async () => {
        if (unitId) {
            if (occupancyIds.length > 0) {
                const results = await Promise.all(
                    occupancyIds.map((occupancyId) =>
                        endAllOccupancyAllocations.mutateAsync({ occupancyId, buildingId })
                    )
                );
                return results.reduce((sum, result) => sum + (result.ended ?? 0), 0);
            }
            const result = await endAllUnitAllocations.mutateAsync({ unitId, buildingId });
            return result.ended ?? 0;
        }
        return 0;
    };

    const handleSaveParkingAllocations = async () => {
        if (!unitId) return;
        const changed = !areParkingSlotSelectionsEqual(selectedSlotIds, currentAllocationSlotIds);
        if (!changed) {
            setIsEditingParking(false);
            return;
        }
        try {
            await clearActiveParkingAllocations();
            if (selectedSlotIds.length > 0) {
                await allocateParkingSlots.mutateAsync({
                    buildingId,
                    data: primaryOccupancy?.id
                        ? { occupancyId: primaryOccupancy.id, slotIds: selectedSlotIds }
                        : { unitId, slotIds: selectedSlotIds },
                });
                toast.success(`${selectedSlotIds.length} parking slot${selectedSlotIds.length === 1 ? "" : "s"} allocated`);
            } else {
                await refreshParkingContext();
                toast.success("Unit parking allocations cleared");
            }
            setIsEditingParking(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update parking allocations";
            if (err instanceof Error && /already allocated|conflict|409/i.test(message)) {
                await refreshParkingContext();
                toast.error("One or more slots were taken. The list has been refreshed — please reselect.");
                return;
            }
            if (err instanceof Error && /not found|404/i.test(message)) {
                await refreshParkingContext();
                setSelectedSlotIds([]);
                toast.error("One or more slots no longer exist. The list has been refreshed — please reselect.");
                return;
            }
            toast.error(message);
        }
    };

    const handleEndAllAllocations = async () => {
        if (!unitId) return;
        try {
            const ended = await clearActiveParkingAllocations();
            await refreshParkingContext();
            setSelectedSlotIds([]);
            setIsEditingParking(false);
            toast.success(`${ended} allocation(s) ended`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to end all unit allocations";
            toast.error(message);
        } finally {
            setConfirmEndAll(false);
        }
    };

    const vehicleQueries = useQueries({
        queries: occupancyIds.map((occupancyId) => ({
            queryKey: ["occupancy-vehicles", occupancyId],
            queryFn: () => getOccupancyVehicles(occupancyId),
            enabled: shouldLoadVehicles && Boolean(occupancyId),
            staleTime: 60_000,
        })),
    });

    const vehicles = useMemo(() => {
        return vehicleQueries.flatMap((query) => query.data || []);
    }, [vehicleQueries]);
    const isVehiclesLoading = vehicleQueries.some((query) => query.isLoading);
    const hasVehiclesError = vehicleQueries.some((query) => query.isError);

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title={unit?.label ? `Unit ${unit.label}` : "Unit Details"}
            description="Review unit details and specifications."
            width="w-full sm:w-[720px] lg:w-[920px]"
        >
            <div className="px-2 sm:px-4">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ) : unit ? (
                    <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-zinc-500">Unit overview</div>
                        {onEdit ? (
                            <Button variant="outline" size="sm" onClick={onEdit}>
                                Edit Unit
                            </Button>
                        ) : null}
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                {unit.label}
                            </Badge>
                            {unit.isAvailable !== undefined ? (
                                <Badge
                                    variant="secondary"
                                    className={unit.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
                                >
                                    {unit.isAvailable ? "Vacant" : "Occupied"}
                                </Badge>
                            ) : null}
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Type</div>
                                <div className="text-sm font-semibold text-zinc-900">{formatValue(unitTypeName || unit.unitTypeId)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Floor</div>
                                <div className="text-sm font-semibold text-zinc-900">{formatValue(unit.floor)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-zinc-400">Size</div>
                                <div className="text-sm font-semibold text-zinc-900">
                                    {formatValue(unit.unitSize)}
                                    {unit.unitSizeUnit ? ` ${unitSizeUnitLabels[unit.unitSizeUnit] || unit.unitSizeUnit}` : ""}
                                </div>
                            </div>
                        </div>
                        {unit.notes ? (
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                <span className="text-xs uppercase tracking-wide text-zinc-400">Notes</span>
                                <div className="mt-1 text-sm text-zinc-700">{unit.notes}</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Unit Specs</h3>
                                <p className="text-xs text-zinc-400">Layout and finishes.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Beds</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.bedrooms)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Baths</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.bathrooms)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Kitchen</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.kitchenType)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Furnished</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.furnishedStatus)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Balcony</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.balcony)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Maintenance</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.maintenancePayer)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Financials</h3>
                                <p className="text-xs text-zinc-400">Rental terms and charges.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Annual Rent</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.rentAnnual)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Payment Frequency</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.paymentFrequency)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Security Deposit</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.securityDepositAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Service Charge</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatMoney(unit.serviceChargePerUnit)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">VAT Applicable</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.vatApplicable)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Ownership</h3>
                                <p className="text-xs text-zinc-400">Primary owner details.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Owner</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.name || unit.ownerId)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Email</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.email)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Phone</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.phone)}</div>
                                </div>
                                <div className="sm:col-span-2">
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Address</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(owner?.address)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Utilities</h3>
                                <p className="text-xs text-zinc-400">Meter tracking.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Electricity</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.electricityMeterNumber)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Water</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.waterMeterNumber)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zinc-400">Gas</div>
                                    <div className="text-sm font-medium text-zinc-900">{formatValue(unit.gasMeterNumber)}</div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-900">Parking</h3>
                                        <p className="text-xs text-zinc-400">Allocated parking slots for this unit.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!isEditingParking && hasAllocatedSlots ? (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setConfirmEndAll(true)}
                                                disabled={isUnitParkingAllocationsLoading || isParkingSaving}
                                            >
                                                End all
                                            </Button>
                                        ) : null}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditingParking((prev) => !prev)}
                                            disabled={isUnitParkingAllocationsLoading || isParkingSaving}
                                        >
                                            {isEditingParking ? "Close" : "Edit allocations"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {isEditingParking ? (
                                vacantSlotsError ? (
                                    <div className="text-sm text-rose-600">
                                        {vacantSlotsError instanceof Error ? vacantSlotsError.message : "Failed to load parking slots."}
                                    </div>
                                ) : isVacantSlotsLoading && normalizedParking.slots.length === 0 ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-4 w-1/3" />
                                    </div>
                                ) : normalizedParking.slots.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {normalizedParking.slots.map((slot) => {
                                                const checked = selectedSlotIds.includes(slot.id);
                                                const isAllocated = slot.isAllocatedToUnit;
                                                return (
                                                    <label
                                                        key={slot.id}
                                                        className={cn(
                                                            "flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer",
                                                            checked ? "border-blue-200 bg-blue-50/40" : "border-zinc-200 bg-white"
                                                        )}
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(next) => {
                                                                const isChecked = Boolean(next);
                                                                setSelectedSlotIds((prev) => {
                                                                    if (isChecked) return prev.includes(slot.id) ? prev : [...prev, slot.id];
                                                                    return prev.filter((id) => id !== slot.id);
                                                                });
                                                            }}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-xs font-semibold text-zinc-800 truncate">{slot.code}</div>
                                                                {isAllocated ? (
                                                                    <span className="rounded-full bg-zinc-900/5 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                                                                        Allocated
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-[11px] text-zinc-500">
                                                                {slot.type} {slot.level ? `- ${slot.level}` : ""} {slot.isCovered ? "(Covered)" : ""}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button type="button" size="sm" onClick={handleSaveParkingAllocations} disabled={isParkingSaving}>
                                                Save allocations
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedSlotIds(Array.from(currentAllocationSlotIds));
                                                    setIsEditingParking(false);
                                                }}
                                                disabled={isParkingSaving}
                                            >
                                                Cancel
                                            </Button>
                                            <div className="text-xs text-zinc-500">{selectedSlotIds.length} selected</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-zinc-500">No parking slots available.</div>
                                )
                            ) : isUnitParkingAllocationsLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/3" />
                                </div>
                            ) : hasUnitParkingAllocationsError ? (
                                <div className="text-sm text-rose-600">Unable to load parking allocations.</div>
                            ) : normalizedParking.allocatedSlots.length > 0 ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {normalizedParking.allocatedSlots.map((slot) => {
                                        return (
                                            <div key={slot.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                                <div className="text-sm font-semibold text-zinc-900">{slot.code}</div>
                                                <div className="mt-2 grid gap-1 text-xs text-zinc-600">
                                                    <div>
                                                        <span className="uppercase tracking-wide text-zinc-400">Type </span>
                                                        <span className="font-medium text-zinc-700">{slot.type || "N/A"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="uppercase tracking-wide text-zinc-400">Level </span>
                                                        <span className="font-medium text-zinc-700">{slot.level || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-sm text-zinc-500">No parking allocations for this unit.</div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Contracts</h3>
                            <p className="text-xs text-zinc-400">
                                Manage move-in, move-out, transfers, and contract updates in the Contracts module.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href={leaseManagementHref}>Open Contracts</Link>
                        </Button>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Residents</h3>
                            <p className="text-xs text-zinc-400">Current occupancy for this unit.</p>
                        </div>
                        {unitResidents.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {unitResidents.map((resident) => (
                                    <div key={resident.userId} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="text-sm font-semibold text-zinc-900">{formatValue(resident.name)}</div>
                                        <div className="text-xs text-zinc-500">{formatValue(resident.email)}</div>
                                        <div className="mt-2 grid gap-2 text-xs text-zinc-600">
                                            <div>
                                                <span className="uppercase tracking-wide text-zinc-400">Status </span>
                                                <span className="font-medium text-zinc-700">{formatValue(resident.status)}</span>
                                            </div>
                                            <div>
                                                <span className="uppercase tracking-wide text-zinc-400">Move-In </span>
                                                <span className="font-medium text-zinc-700">{formatDate(resident.startAt)}</span>
                                            </div>
                                            <div>
                                                <span className="uppercase tracking-wide text-zinc-400">End </span>
                                                <span className="font-medium text-zinc-700">{formatDate(resident.endAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">No residents assigned to this unit.</div>
                        )}
                    </div>

                    {hasAllocatedSlots || isUnitParkingAllocationsLoading || hasUnitParkingAllocationsError ? (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-zinc-900">Vehicles</h3>
                                <p className="text-xs text-zinc-400">
                                    {hasAllocatedSlots
                                        ? `Registered vehicles (capacity: ${allocatedSlotsCount} slot${allocatedSlotsCount === 1 ? "" : "s"}).`
                                        : "Vehicles are shown once parking slots are allocated."}
                                </p>
                            </div>
                            {hasAllocatedSlots && !shouldLoadVehicles ? (
                                <div className="text-sm text-zinc-500">No active resident occupancy for this unit.</div>
                            ) : isVehiclesLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/3" />
                                </div>
                            ) : hasVehiclesError ? (
                                <div className="text-sm text-rose-600">Unable to load vehicles.</div>
                            ) : vehicles.length > 0 ? (
                                <div className="space-y-3">
                                    {vehicles.length > allocatedSlotsCount ? (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            {vehicles.length} vehicles registered for {allocatedSlotsCount} allocated slot{allocatedSlotsCount === 1 ? "" : "s"}.
                                        </div>
                                    ) : null}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {vehicles.map((vehicle) => {
                                            const occupancy = occupancyById.get(vehicle.occupancyId);
                                            const residentLabel = occupancy?.residentName || occupancy?.residentEmail;
                                            return (
                                                <div key={vehicle.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                                    <div className="text-sm font-semibold text-zinc-900">{vehicle.plateNumber}</div>
                                                    {vehicle.label ? (
                                                        <div className="text-xs text-zinc-500">{vehicle.label}</div>
                                                    ) : null}
                                                    {residentLabel ? (
                                                        <div className="mt-2 text-xs text-zinc-600">
                                                            <span className="uppercase tracking-wide text-zinc-400">Resident </span>
                                                            <span className="font-medium text-zinc-700">{residentLabel}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : hasAllocatedSlots ? (
                                <div className="text-sm text-zinc-500">No vehicles registered for this unit.</div>
                            ) : (
                                <div className="text-sm text-zinc-500">No parking slots allocated yet.</div>
                            )}
                        </div>
                    ) : null}

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Amenities</h3>
                            <p className="text-xs text-zinc-400">Assigned amenities for this unit.</p>
                        </div>
                        {unit.amenities && unit.amenities.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {unit.amenities.map((amenity) => (
                                    <Badge key={amenity.id} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                        {amenity.name || amenity.id}
                                    </Badge>
                                ))}
                            </div>
                        ) : unit.amenityIds && unit.amenityIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {unit.amenityIds.map((amenityId) => (
                                    <Badge key={amenityId} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                        {amenityId}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-500">No amenities assigned.</div>
                        )}
                    </div>
                    </div>
                ) : (
                    <div className="text-sm text-zinc-500">Unit details unavailable.</div>
                )}
            </div>
            <ConfirmDialog
                open={confirmEndAll}
                onOpenChange={setConfirmEndAll}
                title="End All Allocations?"
                description={`This will end all ${allocatedSlotsCount} active parking allocation(s) for this unit.`}
                confirmText="End All"
                variant="destructive"
                onConfirm={handleEndAllAllocations}
            />
        </SlideOver>
    );
}
