"use client";

import { useState, useMemo, useEffect } from "react";
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
import type { BuildingOccupancy, ParkingSlot } from "@/lib/types";

interface AllocateParkingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    preSelectedSlotId?: string;
    preSelectedOccupancyId?: string;
    occupancies: BuildingOccupancy[];
}

export function AllocateParkingDialog({
    open,
    onOpenChange,
    buildingId,
    preSelectedSlotId,
    preSelectedOccupancyId,
    occupancies,
}: AllocateParkingDialogProps) {
    const [selectedOccupancyId, setSelectedOccupancyId] = useState(preSelectedOccupancyId || "");
    const [allocationMode, setAllocationMode] = useState<"manual" | "auto">("manual");
    const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(preSelectedSlotId ? [preSelectedSlotId] : []);
    const [autoCount, setAutoCount] = useState(1);

    const { data: availableSlots } = useParkingSlots(buildingId, { available: true, enabled: open && Boolean(buildingId) });
    const createAllocationMutation = useCreateParkingAllocations();

    const activeOccupancies = useMemo(() => {
        return (occupancies || []).filter((o) => o.status === "ACTIVE" || !o.endAt);
    }, [occupancies]);

    // Sync selectedOccupancyId when dialog opens with preSelectedOccupancyId
    useEffect(() => {
        if (open && preSelectedOccupancyId) {
            setSelectedOccupancyId(preSelectedOccupancyId);
        }
    }, [open, preSelectedOccupancyId]);

    const handleSlotToggle = (slotId: string) => {
        setSelectedSlotIds((prev) =>
            prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
        );
    };

    const handleSubmit = async () => {
        if (!selectedOccupancyId) {
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
                        occupancyId: selectedOccupancyId,
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
                        occupancyId: selectedOccupancyId,
                        count: autoCount,
                    },
                });
            }
            toast.success("Parking allocated successfully");
            onOpenChange(false);
            setSelectedOccupancyId("");
            setSelectedSlotIds([]);
            setAutoCount(1);
        } catch (error: any) {
            toast.error(error.message || "Failed to allocate parking");
        }
    };

    const handleClose = (newOpen: boolean) => {
        if (!newOpen) {
            setSelectedOccupancyId(preSelectedOccupancyId || "");
            setSelectedSlotIds(preSelectedSlotId ? [preSelectedSlotId] : []);
            setAutoCount(1);
            setAllocationMode("manual");
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Allocate Parking</DialogTitle>
                    <DialogDescription>
                        Assign parking slots to a resident occupancy.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
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
                    <Button variant="outline" onClick={() => handleClose(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={createAllocationMutation.isPending || !selectedOccupancyId}
                    >
                        {createAllocationMutation.isPending ? "Allocating..." : "Allocate"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
