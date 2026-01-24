"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Car, Plus, Pencil, Trash2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useOccupancyVehicles,
    useCreateVehicle,
    useUpdateVehicle,
    useDeleteVehicle
} from "@/lib/queries";
import type { Vehicle } from "@/lib/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

const vehicleSchema = z.object({
    plateNumber: z.string().trim().min(1, "Plate number is required"),
    label: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

interface VehiclesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    occupancyId: string;
    occupancyLabel?: string;
}

export function VehiclesDialog({
    open,
    onOpenChange,
    occupancyId,
    occupancyLabel,
}: VehiclesDialogProps) {
    const [showForm, setShowForm] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

    const { data: vehicles, isLoading } = useOccupancyVehicles(occupancyId, {
        enabled: open && Boolean(occupancyId),
    });

    const createMutation = useCreateVehicle();
    const updateMutation = useUpdateVehicle();
    const deleteMutation = useDeleteVehicle();

    const form = useForm<VehicleFormValues>({
        resolver: zodResolver(vehicleSchema),
        defaultValues: {
            plateNumber: "",
            label: "",
        },
    });

    const handleStartAdd = () => {
        form.reset({ plateNumber: "", label: "" });
        setEditingVehicle(null);
        setShowForm(true);
    };

    const handleStartEdit = (vehicle: Vehicle) => {
        form.reset({
            plateNumber: vehicle.plateNumber,
            label: vehicle.label || "",
        });
        setEditingVehicle(vehicle);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingVehicle(null);
        form.reset();
    };

    const handleSubmit = async (data: VehicleFormValues) => {
        try {
            if (editingVehicle) {
                await updateMutation.mutateAsync({
                    vehicleId: editingVehicle.id,
                    occupancyId,
                    data: {
                        plateNumber: data.plateNumber,
                        label: data.label || undefined,
                    },
                });
                toast.success("Vehicle updated");
            } else {
                await createMutation.mutateAsync({
                    occupancyId,
                    data: {
                        plateNumber: data.plateNumber,
                        label: data.label || undefined,
                    },
                });
                toast.success("Vehicle added");
            }
            handleCancel();
        } catch (error: any) {
            toast.error(error.message || "Failed to save vehicle");
        }
    };

    const handleDelete = async () => {
        if (!deletingVehicle) return;
        try {
            await deleteMutation.mutateAsync({
                vehicleId: deletingVehicle.id,
                occupancyId,
            });
            toast.success("Vehicle deleted");
            setDeletingVehicle(null);
        } catch (error: any) {
            toast.error(error.message || "Failed to delete vehicle");
        }
    };

    const handleClose = (newOpen: boolean) => {
        if (!newOpen) {
            handleCancel();
        }
        onOpenChange(newOpen);
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <>
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Vehicles</DialogTitle>
                        <DialogDescription>
                            {occupancyLabel
                                ? `Manage registered vehicles for ${occupancyLabel}`
                                : "Register and manage vehicles for this occupancy."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {showForm ? (
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="plateNumber">Plate Number *</Label>
                                    <Input
                                        id="plateNumber"
                                        placeholder="e.g., ABC-1234"
                                        {...form.register("plateNumber")}
                                    />
                                    {form.formState.errors.plateNumber && (
                                        <p className="text-sm text-red-500">
                                            {form.formState.errors.plateNumber.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="label">Label (Optional)</Label>
                                    <Input
                                        id="label"
                                        placeholder="e.g., John's BMW, Family Car"
                                        {...form.register("label")}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancel}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isPending} className="flex-1">
                                        {isPending ? "Saving..." : editingVehicle ? "Update" : "Add"}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <>
                                {isLoading ? (
                                    <div className="space-y-3">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="rounded-lg border border-zinc-200 p-3">
                                                <Skeleton className="h-5 w-24" />
                                                <Skeleton className="mt-2 h-4 w-32" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (vehicles || []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center text-sm text-zinc-500">
                                        No vehicles registered.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(vehicles || []).map((vehicle) => (
                                            <div
                                                key={vehicle.id}
                                                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                                        <Car className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-zinc-900">
                                                            {vehicle.plateNumber}
                                                        </div>
                                                        {vehicle.label && (
                                                            <div className="text-xs text-zinc-500">
                                                                {vehicle.label}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                                                        onClick={() => handleStartEdit(vehicle)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-zinc-500 hover:text-red-600"
                                                        onClick={() => setDeletingVehicle(vehicle)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    variant="outline"
                                    className="mt-4 w-full"
                                    onClick={handleStartAdd}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Vehicle
                                </Button>
                            </>
                        )}
                    </div>

                    {!showForm && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => handleClose(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deletingVehicle)}
                onOpenChange={(open) => !open && setDeletingVehicle(null)}
                title="Delete Vehicle?"
                description={`This will remove ${deletingVehicle?.plateNumber || "this vehicle"} from the system.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />
        </>
    );
}
