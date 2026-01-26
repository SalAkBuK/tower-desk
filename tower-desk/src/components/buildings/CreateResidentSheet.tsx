"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingUnits, useCreateBuildingResident, useBuildingOccupancies, useParkingSlots, useCreateParkingAllocations, useCreateVehicle } from "@/lib/queries";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { AllocateParkingDialog } from "@/components/parking/AllocateParkingDialog";
import type { BuildingResident } from "@/lib/types";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Mail, Home, Shield, ChevronLeft, ChevronRight, Check, Car, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const steps = [
    {
        key: "details",
        title: "Details",
        description: "Review basic resident information",
        icon: User,
        fields: ["name", "email"],
    },
    {
        key: "assignment",
        title: "Assignment",
        description: "Assign unit and set security",
        icon: Home,
        fields: ["unitId", "password"],
    },
] as const;

export function CreateResidentSheet({ open, onOpenChange, buildingId }: CreateResidentSheetProps) {
    const queryClient = useQueryClient();
    const createResident = useCreateBuildingResident();
    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(buildingId, {
        available: true,
        enabled: open,
    });
    const { data: occupancies } = useBuildingOccupancies(buildingId, { enabled: open });
    const { data: availableSlots } = useParkingSlots(buildingId, { available: true, enabled: open });
    const createParkingAllocations = useCreateParkingAllocations();
    const createVehicle = useCreateVehicle();
    const [error, setError] = useState<string | null>(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [createdResident, setCreatedResident] = useState<(BuildingResident & { tempPassword?: string; mustChangePassword?: boolean }) | null>(null);
    const [showParkingDialog, setShowParkingDialog] = useState(false);
    const [vehiclePlates, setVehiclePlates] = useState<string[]>([]);
    const totalSteps = steps.length;
    const currentStep = steps[stepIndex];
    const stepHeaderRef = useRef<HTMLDivElement | null>(null);

    const unitOptions = useMemo(() => {
        return (units || []).map((unit) => ({
            id: unit.id,
            label: unit.label,
        }));
    }, [units]);

    // Find the occupancy for the newly created resident
    const createdOccupancy = useMemo(() => {
        if (!createdResident || !occupancies || !createdResident.unit) return null;
        return occupancies.find(
            (o) => o.unitId === createdResident.unit?.id &&
                   (o.residentUserId === createdResident.userId || o.residentEmail === createdResident.email) &&
                   (o.status === "ACTIVE" || !o.endAt)
        );
    }, [createdResident, occupancies]);

    const hasParkingSlots = (availableSlots || []).length > 0;

    const form = useForm<ResidentFormValues>({
        resolver: zodResolver(residentSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            unitId: "",
        },
    });

    // Get the selected unit's parking slot count
    const selectedUnitId = form.watch("unitId");
    const selectedUnit = useMemo(() => {
        return unitOptions.find(u => u.id === selectedUnitId);
    }, [unitOptions, selectedUnitId]);
    const unitLabel = selectedUnit?.label?.trim() || "";
    const preferredAvailableSlots = useMemo(() => {
        if (!unitLabel) return [];
        const prefix = `${unitLabel.toLowerCase()}-p`;
        return (availableSlots || []).filter((slot) => slot.code?.toLowerCase().startsWith(prefix));
    }, [availableSlots, unitLabel]);
    const allocatedSlotCount = preferredAvailableSlots.length;
    const unitSlotCount = preferredAvailableSlots.length;

    // Reset form only when sheet opens (not when unitOptions changes)
    useEffect(() => {
        if (open) {
            setError(null);
            setStepIndex(0);
            setDirection(0);
            setCreatedResident(null);
            setShowParkingDialog(false);
            setVehiclePlates([]);
            form.reset({
                name: "",
                email: "",
                password: "",
                unitId: "",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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

    // Set default unit when unitOptions loads (only if no unit is selected yet)
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
            await queryClient.refetchQueries({ queryKey: ['building-occupancies', buildingId] });

            // Get the new occupancy
            const updatedOccupancies = queryClient.getQueryData<typeof occupancies>(['building-occupancies', buildingId]);
            const newOccupancy = updatedOccupancies?.find(
                (o) => o.unitId === data.unitId &&
                       (o.residentUserId === result.userId || o.residentEmail === result.email) &&
                       (o.status === "ACTIVE" || !o.endAt)
            );

            // Auto-allocate parking based on unit-prefixed available slots
            if (newOccupancy && allocatedSlotCount > 0 && preferredAvailableSlots.length > 0) {
                const slotsToAllocate = preferredAvailableSlots.length;
                const preferredSlotIds = preferredAvailableSlots.slice(0, slotsToAllocate).map((slot) => slot.id);
                let allocatedCount = 0;
                try {
                    if (preferredSlotIds.length > 0) {
                        await createParkingAllocations.mutateAsync({
                            buildingId,
                            data: {
                                occupancyId: newOccupancy.id,
                                slotIds: preferredSlotIds,
                            },
                        });
                        allocatedCount += preferredSlotIds.length;
                    }
                    const remaining = slotsToAllocate - allocatedCount;
                    if (remaining > 0) {
                        // No additional unit-prefixed slots to allocate.
                    }
                    toast.success(`${allocatedCount} parking slot${allocatedCount !== 1 ? 's' : ''} allocated`);

                    const validPlates = vehiclePlates
                        .slice(0, allocatedCount)
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
                        toast.success(`${validPlates.length} vehicle${validPlates.length !== 1 ? 's' : ''} registered`);
                    }

                } catch {
                    toast.error("Failed to allocate parking");
                }
            }

            setCreatedResident(result);
            setDirection(1);
            setStepIndex(totalSteps); // Move to success step
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create resident";
            setError(message);
            toast.error(message);
        }
    };

    const handleNextStep = async () => {
        const fields = [...currentStep.fields];
        const isValid = await form.trigger(fields);

        if (isValid) {
            setDirection(1);
            setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
        }
    };

    const handlePrevStep = () => {
        setDirection(-1);
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 20 : -20,
            opacity: 0,
        }),
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Add Resident"
            description="Create a resident and link them to a unit."
            width="w-full sm:w-[600px]"
        >
            <div className="flex h-full flex-col">
                {stepIndex < totalSteps && (
                    <div className="border-b bg-zinc-50/50 px-6 py-4 backdrop-blur-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900">{currentStep?.title}</h3>
                                <p className="text-sm text-zinc-500">{currentStep?.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <span className="font-medium text-zinc-900">{stepIndex + 1}</span>
                                <span>/</span>
                                <span>{totalSteps}</span>
                            </div>
                        </div>

                        {/* Visual Stepper */}
                        <div className="relative flex items-center justify-between px-2">
                            <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-zinc-200" />
                            <div
                                className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-zinc-900 transition-all duration-500 ease-in-out"
                                style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
                            />
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === stepIndex;
                                const isCompleted = index < stepIndex;

                                return (
                                    <div key={step.key} className="relative flex flex-col items-center gap-2">
                                        <div
                                            className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-300",
                                                isActive ? "border-zinc-900 text-zinc-900 scale-110 shadow-sm" :
                                                    isCompleted ? "border-zinc-900 bg-zinc-900 text-white" :
                                                        "border-zinc-200 text-zinc-300"
                                            )}
                                        >
                                            {isCompleted ? (
                                                <Check className="h-4 w-4" strokeWidth={3} />
                                            ) : (
                                                <Icon className="h-4 w-4" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-6" ref={stepHeaderRef}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait" initial={false} custom={direction}>
                                <motion.div
                                    key={stepIndex}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-6"
                                >
                                    {stepIndex === 0 && (
                                        <div className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Resident Name</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                <Input placeholder="John Doe" {...field} className="pl-9 h-11" />
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
                                                                <Input type="email" placeholder="resident@example.com" {...field} className="pl-9 h-11" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {stepIndex === 1 && (
                                        <div className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="unitId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Assign Unit</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isUnitsLoading}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-11">
                                                                    <div className="flex items-center gap-2">
                                                                        <Home className="h-4 w-4 text-zinc-400" />
                                                                        <SelectValue placeholder={isUnitsLoading ? "Loading units..." : "Select a unit"} />
                                                                    </div>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {unitOptions.length === 0 && !isUnitsLoading ? (
                                                                    <SelectItem value="none" disabled>No available units</SelectItem>
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
                                                        <FormLabel>Password <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                <Input type="password" placeholder="Set initial password" {...field} className="pl-9 h-11" />
                                                            </div>
                                                        </FormControl>
                                                        <p className="text-xs text-zinc-500 mt-1.5">
                                                            Leave blank to let the resident set their own password via email invite.
                                                        </p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {unitSlotCount > 0 && (
                                                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4">
                                                    <div className="flex items-center gap-2">
                                                        <Car className="h-4 w-4 text-zinc-600" />
                                                        <Label className="font-medium text-zinc-900">
                                                            Vehicle Registration <span className="text-zinc-400 font-normal">(Optional)</span>
                                                        </Label>
                                                    </div>
                                                    <p className="text-xs text-zinc-500">
                                                        This unit has {unitSlotCount} parking slot{unitSlotCount !== 1 ? 's' : ''}.
                                                        Enter vehicle plate numbers to register them.
                                                    </p>
                                                    <div className="grid gap-3">
                                                        {vehiclePlates.map((plate, index) => (
                                                            <div key={index} className="flex items-center gap-2">
                                                                <span className="text-xs text-zinc-500 w-6">#{index + 1}</span>
                                                                <Input
                                                                    placeholder={`Vehicle ${index + 1} plate number`}
                                                                    value={plate}
                                                                    onChange={(e) => {
                                                                        const newPlates = [...vehiclePlates];
                                                                        newPlates[index] = e.target.value.toUpperCase();
                                                                        setVehiclePlates(newPlates);
                                                                    }}
                                                                    className="h-10 font-mono"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {error && (
                                                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                                    {error}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Success state */}
                                    {stepIndex === totalSteps && createdResident && (
                                        <div className="flex flex-col items-center text-center py-6">
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                                                Resident Created
                                            </h3>
                                            <p className="text-sm text-zinc-500 mb-6">
                                                {createdResident.name} has been added to {createdResident.unit?.label || "the unit"}.
                                            </p>

                                            {hasParkingSlots && createdOccupancy && (
                                                <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 mb-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-200">
                                                            <Car className="h-5 w-5 text-zinc-600" />
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="font-medium text-zinc-900 text-sm">Allocate Parking?</p>
                                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                                {(availableSlots || []).length} parking slot{(availableSlots || []).length !== 1 ? 's' : ''} available
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setShowParkingDialog(true)}
                                                            className="shrink-0"
                                                        >
                                                            Allocate
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {!hasParkingSlots && (
                                                <p className="text-xs text-zinc-400 mb-4">
                                                    No parking slots available to allocate.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </form>
                    </Form>
                </div>

                <div className="border-t bg-white px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {stepIndex === totalSteps ? (
                                // Success state - no back button
                                <div />
                            ) : stepIndex > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handlePrevStep}
                                    className="gap-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {stepIndex === totalSteps ? (
                                <Button onClick={() => onOpenChange(false)}>
                                    Done
                                </Button>
                            ) : stepIndex === totalSteps - 1 ? (
                                <Button
                                    onClick={form.handleSubmit(onSubmit)}
                                    disabled={createResident.isPending || unitOptions.length === 0}
                                    className="gap-2 min-w-[120px]"
                                >
                                    {createResident.isPending ? "Creating..." : "Create Resident"}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleNextStep}
                                    className="gap-2 min-w-[100px]"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Parking allocation dialog */}
            {createdOccupancy && (
                <AllocateParkingDialog
                    open={showParkingDialog}
                    onOpenChange={setShowParkingDialog}
                    buildingId={buildingId}
                    occupancies={occupancies || []}
                    preSelectedOccupancyId={createdOccupancy.id}
                />
            )}
        </SlideOver>
    );
}
