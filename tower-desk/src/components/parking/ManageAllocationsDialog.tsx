"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Car, Bike, Zap, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useOccupancyParkingAllocations,
    useEndParkingAllocation,
    useEndAllParkingAllocations
} from "@/lib/queries";
import type { ParkingSlotType } from "@/lib/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

const slotTypeIcon: Record<ParkingSlotType, ReactNode> = {
    CAR: <Car className="h-4 w-4" />,
    BIKE: <Bike className="h-4 w-4" />,
    EV: <Zap className="h-4 w-4" />,
};

interface ManageAllocationsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    occupancyId: string;
    buildingId: string;
    occupancyLabel?: string;
}

export function ManageAllocationsDialog({
    open,
    onOpenChange,
    occupancyId,
    buildingId,
    occupancyLabel,
}: ManageAllocationsDialogProps) {
    const [confirmEndAll, setConfirmEndAll] = useState(false);
    const [endingAllocationId, setEndingAllocationId] = useState<string | null>(null);

    const { data: allocations, isLoading } = useOccupancyParkingAllocations(occupancyId, {
        active: true,
        enabled: open && Boolean(occupancyId),
    });

    const endAllocationMutation = useEndParkingAllocation();
    const endAllMutation = useEndAllParkingAllocations();

    const handleEndAllocation = async (allocationId: string) => {
        try {
            await endAllocationMutation.mutateAsync({
                allocationId,
                buildingId,
                occupancyId,
            });
            toast.success("Allocation ended");
            setEndingAllocationId(null);
        } catch (error: any) {
            toast.error(error.message || "Failed to end allocation");
        }
    };

    const handleEndAll = async () => {
        try {
            const result = await endAllMutation.mutateAsync({
                occupancyId,
                buildingId,
            });
            toast.success(`${result.ended} allocation(s) ended`);
            setConfirmEndAll(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to end allocations");
        }
    };

    const activeAllocations = (allocations || []).filter((a) => !a.endDate);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Parking Allocations</DialogTitle>
                        <DialogDescription>
                            {occupancyLabel ? `Manage parking for ${occupancyLabel}` : "View and manage parking allocations."}
                        </DialogDescription>
                        <p className="text-xs text-zinc-500">
                            Active allocations: {activeAllocations.length}
                        </p>
                    </DialogHeader>

                    <div className="py-4">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-lg border border-zinc-200 p-3">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="mt-2 h-4 w-32" />
                                    </div>
                                ))}
                            </div>
                        ) : activeAllocations.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center text-sm text-zinc-500">
                                No active parking allocations.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeAllocations.map((allocation) => (
                                    <div
                                        key={allocation.id}
                                        className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                                {slotTypeIcon[allocation.slot.type]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-zinc-900">
                                                    {allocation.slot.code}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    {allocation.slot.level || "No level"} &middot; {allocation.slot.type}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                                Active
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-500 hover:text-red-600"
                                                onClick={() => setEndingAllocationId(allocation.id)}
                                                disabled={endAllocationMutation.isPending}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        {activeAllocations.length > 0 && (
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmEndAll(true)}
                                disabled={endAllMutation.isPending}
                            >
                                End All
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={confirmEndAll}
                onOpenChange={setConfirmEndAll}
                title="End All Allocations?"
                description={`This will end all ${activeAllocations.length} active parking allocation(s) for this occupancy.`}
                confirmText="End All"
                variant="destructive"
                onConfirm={handleEndAll}
            />

            <ConfirmDialog
                open={Boolean(endingAllocationId)}
                onOpenChange={(open) => !open && setEndingAllocationId(null)}
                title="End Allocation?"
                description="This parking slot will become available for other tenants."
                confirmText="End Allocation"
                variant="destructive"
                onConfirm={() => endingAllocationId && handleEndAllocation(endingAllocationId)}
            />
        </>
    );
}
