"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateParkingAllocations, useParkingSlots } from "@/lib/queries";
import type { BuildingOccupancy, BuildingUnit } from "@/lib/types";

interface AllocateParkingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    preSelectedSlotId?: string;
    preSelectedOccupancyId?: string;
    preSelectedUnitId?: string;
    occupancies: BuildingOccupancy[];
    units?: BuildingUnit[];
    allowUnitTargeting?: boolean;
}

export function AllocateParkingDialog({
    open,
    onOpenChange,
    buildingId,
    preSelectedSlotId,
    preSelectedOccupancyId,
    preSelectedUnitId,
    occupancies,
    units,
    allowUnitTargeting = false,
}: AllocateParkingDialogProps) {
    const [selectedOccupancyId, setSelectedOccupancyId] = useState(preSelectedOccupancyId || "");
    const [selectedUnitId, setSelectedUnitId] = useState(preSelectedUnitId || "");
    const [targetMode, setTargetMode] = useState<"occupancy" | "unit">(
        preSelectedOccupancyId ? "occupancy" : preSelectedUnitId ? "unit" : "occupancy"
    );
    const [allocationMode, setAllocationMode] = useState<"manual" | "auto">("manual");
    const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(preSelectedSlotId ? [preSelectedSlotId] : []);
    const [autoCount, setAutoCount] = useState(1);

    const { data: availableSlots } = useParkingSlots(buildingId, { available: true, enabled: open && Boolean(buildingId) });
    const createAllocationMutation = useCreateParkingAllocations();

    const activeOccupancies = useMemo(() => {
        return (occupancies || []).filter((o) => o.status === "ACTIVE" || !o.endAt);
    }, [occupancies]);

    const availableUnits = useMemo(() => {
        return (units || []).slice().sort((a, b) => a.label.localeCompare(b.label));
    }, [units]);

    const canTargetUnits = allowUnitTargeting && availableUnits.length > 0;

    const handleSlotToggle = (slotId: string) => {
        setSelectedSlotIds((prev) =>
            prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
        );
    };

    const handleSubmit = async () => {
        const isUnitTarget = canTargetUnits && targetMode === "unit";
        if (isUnitTarget) {
            if (!selectedUnitId) {
                toast.error("Please select a unit");
                return;
            }
        } else if (!selectedOccupancyId) {
            toast.error("Please select an occupancy");
            return;
        }

        try {
            if (allocationMode === "manual") {
                if (selectedSlotIds.length === 0) {
                    toast.error("Please select at least one slot");
                    return;
                }
                await createAllocationMutation.mutateAsync({
                    buildingId,
                    data: {
                        occupancyId: isUnitTarget ? undefined : selectedOccupancyId,
                        unitId: isUnitTarget ? selectedUnitId : undefined,
                        slotIds: selectedSlotIds,
                    },
                });
            } else {
                if (autoCount < 1) {
                    toast.error("Please enter a valid count");
                    return;
                }
                await createAllocationMutation.mutateAsync({
                    buildingId,
                    data: {
                        occupancyId: isUnitTarget ? undefined : selectedOccupancyId,
                        unitId: isUnitTarget ? selectedUnitId : undefined,
                        count: autoCount,
                    },
                });
            }
            toast.success("Parking allocated successfully");
            onOpenChange(false);
            setSelectedOccupancyId("");
            setSelectedUnitId("");
            setSelectedSlotIds([]);
            setAutoCount(1);
        } catch (error: any) {
            toast.error(error.message || "Failed to allocate parking");
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            if (preSelectedOccupancyId) {
                setSelectedOccupancyId(preSelectedOccupancyId);
                setSelectedUnitId("");
                setTargetMode("occupancy");
            } else if (preSelectedUnitId) {
                setSelectedUnitId(preSelectedUnitId);
                setSelectedOccupancyId("");
                setTargetMode("unit");
            } else if (canTargetUnits && activeOccupancies.length === 0) {
                setTargetMode("unit");
            } else {
                setTargetMode("occupancy");
            }
            setSelectedSlotIds(preSelectedSlotId ? [preSelectedSlotId] : []);
            setAutoCount(1);
            setAllocationMode("manual");
        } else {
            setSelectedOccupancyId(preSelectedOccupancyId || "");
            setSelectedUnitId(preSelectedUnitId || "");
            setSelectedSlotIds(preSelectedSlotId ? [preSelectedSlotId] : []);
            setAutoCount(1);
            setAllocationMode("manual");
            setTargetMode(preSelectedOccupancyId ? "occupancy" : preSelectedUnitId ? "unit" : "occupancy");
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Allocate Parking</DialogTitle>
                    <DialogDescription>
                        Assign parking slots to a resident occupancy or a vacant unit.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {canTargetUnits ? (
                        <div className="space-y-3">
                            <Label>Allocate To</Label>
                            <RadioGroup value={targetMode} onValueChange={(v) => setTargetMode(v as "occupancy" | "unit")}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="occupancy" id="target-occupancy" />
                                    <Label htmlFor="target-occupancy" className="cursor-pointer font-normal">
                                        Occupancy
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="unit" id="target-unit" />
                                    <Label htmlFor="target-unit" className="cursor-pointer font-normal">
                                        Unit (no occupancy)
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    ) : null}

                    {targetMode === "unit" && canTargetUnits ? (
                        <div className="space-y-2">
                            <Label>Select Unit *</Label>
                            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUnits.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            No units available
                                        </SelectItem>
                                    ) : (
                                        availableUnits.map((unit) => (
                                            <SelectItem key={unit.id} value={unit.id}>
                                                {unit.label}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Select Occupancy *</Label>
                            <Select value={selectedOccupancyId} onValueChange={setSelectedOccupancyId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose an occupancy" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeOccupancies.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            No active occupancies
                                        </SelectItem>
                                    ) : (
                                        activeOccupancies.map((occ) => (
                                            <SelectItem key={occ.id} value={occ.id}>
                                                {occ.unitLabel || "Unit"} - {occ.residentName || occ.residentEmail || "Unknown"}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label>Allocation Mode</Label>
                        <RadioGroup value={allocationMode} onValueChange={(v) => setAllocationMode(v as "manual" | "auto")}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="manual" id="manual" />
                                <Label htmlFor="manual" className="cursor-pointer font-normal">
                                    Manual - Select specific slots
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="auto" id="auto" />
                                <Label htmlFor="auto" className="cursor-pointer font-normal">
                                    Auto - Assign available slots automatically
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {allocationMode === "manual" ? (
                        <div className="space-y-3">
                            <Label>Select Slots ({selectedSlotIds.length} selected)</Label>
                            {(availableSlots || []).length === 0 ? (
                                <p className="text-sm text-zinc-500">No available slots in this building.</p>
                            ) : (
                                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-3">
                                    {(availableSlots || []).map((slot) => (
                                        <div key={slot.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={slot.id}
                                                checked={selectedSlotIds.includes(slot.id)}
                                                onCheckedChange={() => handleSlotToggle(slot.id)}
                                            />
                                            <Label htmlFor={slot.id} className="flex-1 cursor-pointer font-normal">
                                                <span className="font-medium">{slot.code}</span>
                                                <span className="ml-2 text-xs text-zinc-500">
                                                    {slot.type} {slot.level ? `- ${slot.level}` : ""} {slot.isCovered ? "(Covered)" : ""}
                                                </span>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="autoCount">Number of Slots</Label>
                            <Input
                                id="autoCount"
                                type="number"
                                min={1}
                                max={(availableSlots || []).length}
                                value={autoCount}
                                onChange={(e) => setAutoCount(parseInt(e.target.value) || 1)}
                            />
                            <p className="text-xs text-zinc-500">
                                {(availableSlots || []).length} slots available
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={
                            createAllocationMutation.isPending ||
                            (targetMode === "unit" && canTargetUnits ? !selectedUnitId : !selectedOccupancyId)
                        }
                    >
                        {createAllocationMutation.isPending ? "Allocating..." : "Allocate"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
