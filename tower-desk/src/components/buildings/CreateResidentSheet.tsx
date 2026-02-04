"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User, Mail, Home, Shield, Car } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    useBuildingUnits,
    useCreateBuildingResident,
    useBuildingOccupancies,
    useCreateVehicle,
    useUnitParkingAllocations,
} from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

const residentSchema = z.object({
    name: z.string().trim().min(2, "Resident name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
    unitId: z.string().trim().min(1, "Unit is required"),
});

type ResidentFormValues = z.infer<typeof residentSchema>;

interface CreateResidentSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
}

export function CreateResidentSheet({ open, onOpenChange, buildingId }: CreateResidentSheetProps) {
    const queryClient = useQueryClient();
    const createResident = useCreateBuildingResident();
    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(buildingId, {
        available: true,
        enabled: open,
    });
    const { data: occupancies } = useBuildingOccupancies(buildingId, { enabled: open });
    const createVehicle = useCreateVehicle();
    const [error, setError] = useState<string | null>(null);
    const [vehiclePlates, setVehiclePlates] = useState<string[]>([]);

    const unitOptions = useMemo(() => {
        return (units || []).map((unit) => ({
            id: unit.id,
            label: unit.label,
        }));
    }, [units]);

    const form = useForm<ResidentFormValues>({
        resolver: zodResolver(residentSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            unitId: "",
        },
    });

    const selectedUnitId = form.watch("unitId");
    const selectedUnit = useMemo(() => {
        return unitOptions.find((u) => u.id === selectedUnitId);
    }, [unitOptions, selectedUnitId]);

    const unitAllocationsQuery = useUnitParkingAllocations(selectedUnitId || "", {
        enabled: open && Boolean(selectedUnitId),
    });
    const unitAllocations = unitAllocationsQuery.data || [];
    const unitSlotCount = unitAllocations.length;

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setError(null);
            setVehiclePlates([]);
            form.reset({
                name: "",
                email: "",
                password: "",
                unitId: "",
            });
        }
    }, [open, form]);

    // Update vehicle plates array when selected unit changes
    useEffect(() => {
        if (unitSlotCount > 0) {
            setVehiclePlates((prev) => {
                if (prev.length === unitSlotCount) return prev;
                const newPlates = Array(unitSlotCount).fill("");
                for (let i = 0; i < Math.min(prev.length, unitSlotCount); i++) {
                    newPlates[i] = prev[i];
                }
                return newPlates;
            });
        } else {
            setVehiclePlates([]);
        }
    }, [unitSlotCount]);

    // Set default unit when unitOptions loads
    useEffect(() => {
        if (open && unitOptions.length > 0 && !form.getValues("unitId")) {
            form.setValue("unitId", unitOptions[0].id);
        }
    }, [open, unitOptions, form]);

    const onSubmit = async (data: ResidentFormValues) => {
        setError(null);
        try {
            const result = await createResident.mutateAsync({
                buildingId,
                data: {
                    name: data.name.trim(),
                    email: data.email.trim(),
                    password: data.password?.trim() || undefined,
                    unitId: data.unitId,
                },
            });
            toast.success("Resident created");

            // Refetch occupancies to get the newly created one
            await queryClient.refetchQueries({ queryKey: ["building-occupancies", buildingId] });

            // Get the new occupancy for vehicle registration
            const updatedOccupancies = queryClient.getQueryData<typeof occupancies>([
                "building-occupancies",
                buildingId,
            ]);
            const newOccupancy = updatedOccupancies?.find(
                (o) =>
                    o.unitId === data.unitId &&
                    (o.residentUserId === result.userId || o.residentEmail === result.email) &&
                    (o.status === "ACTIVE" || !o.endAt)
            );

            // Register vehicles if any
            if (newOccupancy && unitSlotCount > 0) {
                const validPlates = vehiclePlates
                    .slice(0, unitSlotCount)
                    .map((plate) => plate.trim())
                    .filter(Boolean);
                for (const plateNumber of validPlates) {
                    try {
                        await createVehicle.mutateAsync({
                            occupancyId: newOccupancy.id,
                            data: { plateNumber },
                        });
                    } catch {
                        // Continue with other vehicles if one fails
                    }
                }
                if (validPlates.length > 0) {
                    toast.success(`${validPlates.length} vehicle${validPlates.length !== 1 ? "s" : ""} registered`);
                }
            }

            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create resident";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Resident</DialogTitle>
                    <DialogDescription>Create a new resident and assign them to a unit.</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input placeholder="John Doe" {...field} className="pl-9" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input type="email" placeholder="resident@example.com" {...field} className="pl-9" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="unitId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isUnitsLoading}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <div className="flex items-center gap-2">
                                                    <Home className="h-4 w-4 text-zinc-400" />
                                                    <SelectValue
                                                        placeholder={isUnitsLoading ? "Loading units..." : "Select a unit"}
                                                    />
                                                </div>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {unitOptions.length === 0 && !isUnitsLoading ? (
                                                <SelectItem value="none" disabled>
                                                    No available units
                                                </SelectItem>
                                            ) : (
                                                unitOptions.map((unit) => (
                                                    <SelectItem key={unit.id} value={unit.id}>
                                                        {unit.label}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Password <span className="text-zinc-400 font-normal">(Optional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input type="password" placeholder="Set initial password" {...field} className="pl-9" />
                                        </div>
                                    </FormControl>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Leave blank to let the resident set their own password via email invite.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {unitSlotCount > 0 && (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-zinc-600" />
                                    <Label className="font-medium text-zinc-900">
                                        Vehicles <span className="text-zinc-400 font-normal">(Optional)</span>
                                    </Label>
                                </div>
                                <p className="text-xs text-zinc-500">
                                    This unit has {unitSlotCount} parking slot{unitSlotCount !== 1 ? "s" : ""}. Enter vehicle
                                    plate numbers to register them.
                                </p>
                                <div className="grid gap-2">
                                    {vehiclePlates.map((plate, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-500 w-6">#{index + 1}</span>
                                            <Input
                                                placeholder={`Vehicle ${index + 1} plate`}
                                                value={plate}
                                                onChange={(e) => {
                                                    const newPlates = [...vehiclePlates];
                                                    newPlates[index] = e.target.value.toUpperCase();
                                                    setVehiclePlates(newPlates);
                                                }}
                                                className="font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createResident.isPending || unitOptions.length === 0}>
                                {createResident.isPending ? "Creating..." : "Create Resident"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
