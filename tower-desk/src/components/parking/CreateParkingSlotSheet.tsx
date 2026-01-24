"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SlideOver } from "@/components/common/SlideOver";
import { useCreateParkingSlot, useUpdateParkingSlot } from "@/lib/queries";
import type { ParkingSlot, ParkingSlotType } from "@/lib/types";

const parkingSlotSchema = z.object({
    code: z.string().trim().min(1, "Slot code is required"),
    type: z.enum(["CAR", "BIKE", "EV"] as const),
    level: z.string().optional(),
    isCovered: z.boolean(),
});

type ParkingSlotFormValues = z.infer<typeof parkingSlotSchema>;

interface CreateParkingSlotSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    mode?: "create" | "edit";
    slot?: ParkingSlot;
}

export function CreateParkingSlotSheet({
    open,
    onOpenChange,
    buildingId,
    mode = "create",
    slot,
}: CreateParkingSlotSheetProps) {
    const isEditMode = mode === "edit" && Boolean(slot);
    const createMutation = useCreateParkingSlot();
    const updateMutation = useUpdateParkingSlot();

    const form = useForm<ParkingSlotFormValues>({
        resolver: zodResolver(parkingSlotSchema),
        defaultValues: {
            code: "",
            type: "CAR",
            level: "",
            isCovered: false,
        },
    });

    useEffect(() => {
        if (!open) {
            form.reset({
                code: "",
                type: "CAR",
                level: "",
                isCovered: false,
            });
            return;
        }
        if (isEditMode && slot) {
            form.reset({
                code: slot.code,
                type: slot.type,
                level: slot.level || "",
                isCovered: slot.isCovered,
            });
        }
    }, [open, isEditMode, slot, form]);

    const onSubmit = async (data: ParkingSlotFormValues) => {
        try {
            if (isEditMode && slot) {
                await updateMutation.mutateAsync({
                    slotId: slot.id,
                    buildingId,
                    data: {
                        code: data.code,
                        type: data.type as ParkingSlotType,
                        level: data.level || undefined,
                        isCovered: data.isCovered,
                    },
                });
                toast.success("Parking slot updated");
            } else {
                await createMutation.mutateAsync({
                    buildingId,
                    data: {
                        code: data.code,
                        type: data.type as ParkingSlotType,
                        level: data.level || undefined,
                        isCovered: data.isCovered,
                    },
                });
                toast.success("Parking slot created");
            }
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save parking slot");
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title={isEditMode ? "Edit Parking Slot" : "Create Parking Slot"}
            description={isEditMode ? "Update parking slot details." : "Add a new parking slot to the building."}
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="code">Slot Code *</Label>
                    <Input
                        id="code"
                        placeholder="e.g., A-01, B-23"
                        {...form.register("code")}
                    />
                    {form.formState.errors.code && (
                        <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="type">Slot Type *</Label>
                    <Select
                        value={form.watch("type")}
                        onValueChange={(value) => form.setValue("type", value as ParkingSlotType)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CAR">Car</SelectItem>
                            <SelectItem value="BIKE">Bike</SelectItem>
                            <SelectItem value="EV">EV (Electric Vehicle)</SelectItem>
                        </SelectContent>
                    </Select>
                    {form.formState.errors.type && (
                        <p className="text-sm text-red-500">{form.formState.errors.type.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="level">Level (Optional)</Label>
                    <Input
                        id="level"
                        placeholder="e.g., Ground, Level 2, Basement"
                        {...form.register("level")}
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="isCovered"
                        checked={form.watch("isCovered")}
                        onCheckedChange={(checked) => form.setValue("isCovered", Boolean(checked))}
                    />
                    <Label htmlFor="isCovered" className="cursor-pointer">
                        Covered parking
                    </Label>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isPending} className="flex-1">
                        {isPending ? "Saving..." : isEditMode ? "Update" : "Create"}
                    </Button>
                </div>
            </form>
        </SlideOver>
    );
}
