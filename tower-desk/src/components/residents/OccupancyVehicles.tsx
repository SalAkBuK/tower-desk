"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    useOccupancyVehicles,
    useOccupancyParkingAllocations,
    useCreateVehicle,
    useUpdateVehicle,
    useDeleteVehicle,
} from "@/lib/queries";

interface OccupancyVehiclesProps {
    occupancyId: string;
    isLoading?: boolean;
    noOccupancyMessage?: string;
}

export function OccupancyVehicles({
    occupancyId,
    isLoading = false,
    noOccupancyMessage = "No active occupancy found for this resident.",
}: OccupancyVehiclesProps) {
    const [vehicleEdits, setVehicleEdits] = useState<Record<string, string>>({});
    const [newVehiclePlate, setNewVehiclePlate] = useState("");

    const vehiclesQuery = useOccupancyVehicles(occupancyId, { enabled: Boolean(occupancyId) });
    const allocationsQuery = useOccupancyParkingAllocations(occupancyId, {
        active: true,
        enabled: Boolean(occupancyId),
    });
    const createMutation = useCreateVehicle();
    const updateMutation = useUpdateVehicle();
    const deleteMutation = useDeleteVehicle();

    const vehicles = vehiclesQuery.data || [];
    const allocations = allocationsQuery.data || [];

    if (!occupancyId) {
        return (
            <div className="text-sm text-zinc-500">
                {isLoading ? "Loading occupancy..." : noOccupancyMessage}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {vehiclesQuery.isLoading || allocationsQuery.isLoading ? (
                <div className="text-sm text-zinc-500">Loading vehicles...</div>
            ) : vehicles.length > 0 ? (
                <div className="space-y-3">
                    {vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex items-center gap-2">
                            <Input
                                value={vehicleEdits[vehicle.id] ?? vehicle.plateNumber}
                                onChange={(event) =>
                                    setVehicleEdits((prev) => ({ ...prev, [vehicle.id]: event.target.value }))
                                }
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    const nextPlate = (vehicleEdits[vehicle.id] ?? vehicle.plateNumber).trim();
                                    if (!nextPlate) {
                                        toast.error("Plate number is required.");
                                        return;
                                    }
                                    try {
                                        await updateMutation.mutateAsync({
                                            vehicleId: vehicle.id,
                                            occupancyId: vehicle.occupancyId,
                                            data: { plateNumber: nextPlate },
                                        });
                                        toast.success("Vehicle updated");
                                        setVehicleEdits((prev) => {
                                            const next = { ...prev };
                                            delete next[vehicle.id];
                                            return next;
                                        });
                                    } catch (error) {
                                        toast.error(error instanceof Error ? error.message : "Failed to update vehicle");
                                    }
                                }}
                                disabled={updateMutation.isPending}
                            >
                                Save
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        await deleteMutation.mutateAsync({
                                            vehicleId: vehicle.id,
                                            occupancyId: vehicle.occupancyId,
                                        });
                                        toast.success("Vehicle removed");
                                    } catch (error) {
                                        toast.error(error instanceof Error ? error.message : "Failed to remove vehicle");
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}

            {vehicles.length === 0 && allocations.length === 0 ? (
                <div className="text-sm text-zinc-500">No vehicles registered.</div>
            ) : null}

            <div className="flex items-center gap-2">
                <Input
                    placeholder="Plate number"
                    value={newVehiclePlate}
                    onChange={(event) => setNewVehiclePlate(event.target.value)}
                />
                <Button
                    onClick={async () => {
                        const plate = newVehiclePlate.trim();
                        if (!plate) {
                            toast.error("Plate number is required.");
                            return;
                        }
                        if (!occupancyId) {
                            toast.error("No active occupancy found for this resident.");
                            return;
                        }
                        try {
                            await createMutation.mutateAsync({
                                occupancyId,
                                data: { plateNumber: plate },
                            });
                            toast.success("Vehicle added");
                            setNewVehiclePlate("");
                        } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to add vehicle");
                        }
                    }}
                    disabled={createMutation.isPending}
                >
                    Add
                </Button>
            </div>

            {allocations.length > 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Allocated Parking Slots
                    </div>
                    <div className="mt-2 space-y-2">
                        {allocations.map((allocation) => (
                            <div key={allocation.id} className="flex items-center justify-between text-sm text-zinc-700">
                                <span className="font-medium text-zinc-900">{allocation.slot.code}</span>
                                <span className="text-xs text-zinc-500">
                                    {allocation.slot.level || "No level"} &middot; {allocation.slot.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
