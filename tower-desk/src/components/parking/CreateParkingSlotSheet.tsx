"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save parking slot");
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;
    const currentType = useWatch({ control: form.control, name: "type" }) ?? "CAR";
    const currentCovered = useWatch({ control: form.control, name: "isCovered" }) ?? false;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
                <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 text-left">
                    <DialogTitle className="text-base text-zinc-950">
                        {isEditMode ? "Edit Parking Slot" : "Create Parking Slot"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500">
                        {isEditMode ? "Update parking slot details." : "Add a new parking slot to the building."}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex max-h-[85vh] flex-col">
                    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 px-6 py-6">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-zinc-900">
                                            {isEditMode ? "Update parking slot" : "Create parking slot"}
                                        </h3>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Define the slot identity and availability details used throughout parking allocation flows.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                                            {currentType}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                                            currentCovered
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : "border-zinc-200 bg-white text-zinc-700"
                                        }`}>
                                            {currentCovered ? "Covered" : "Open"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                                <div className="mb-5">
                                    <h3 className="text-sm font-semibold text-zinc-950">Slot details</h3>
                                    <p className="mt-1 text-sm text-zinc-500">Capture the slot code, type, level, and coverage in one place.</p>
                                </div>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Slot Code *</Label>
                                        <Input
                                            id="code"
                                            placeholder="e.g., A-01, B-23"
                                            {...form.register("code")}
                                        />
                                        {form.formState.errors.code ? (
                                            <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="type">Slot Type *</Label>
                                        <Select
                                            value={currentType}
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
                                        {form.formState.errors.type ? (
                                            <p className="text-sm text-red-500">{form.formState.errors.type.message}</p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="level">Level</Label>
                                        <Input
                                            id="level"
                                            placeholder="e.g., Ground, Level 2, Basement"
                                            {...form.register("level")}
                                        />
                                        <p className="text-xs text-zinc-500">Optional. Use the building’s parking level naming convention.</p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex items-start space-x-3">
                                            <Checkbox
                                                id="isCovered"
                                                checked={currentCovered}
                                                onCheckedChange={(checked) => form.setValue("isCovered", Boolean(checked))}
                                            />
                                            <div>
                                                <Label htmlFor="isCovered" className="cursor-pointer">Covered parking</Label>
                                                <p className="mt-1 text-sm text-zinc-500">
                                                    Mark this when the slot is sheltered or in covered parking inventory.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </form>
                    </div>
                    <div className="border-t border-zinc-100 bg-white px-6 py-4">
                        <DialogFooter className="flex-row justify-end gap-3 sm:space-x-0">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isPending}
                                className="h-11 rounded-xl bg-zinc-900 px-5 text-white hover:bg-zinc-800"
                            >
                                {isPending ? "Saving..." : isEditMode ? "Update slot" : "Create slot"}
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
