"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { User, Phone, Car, Clock, Home, CreditCard } from "lucide-react";

import { SlideOver } from "@/components/common/SlideOver";
import { VirtualizedUnitSelect } from "@/components/buildings/VirtualizedUnitSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateVisitor, useBuildingUnits, useBuildingOccupancies } from "@/lib/queries";
import type { BuildingOccupancy, BuildingUnit } from "@/lib/types";
import { VisitorType } from "@/lib/types";
import { visitorTypeLabels, visitorTypes } from "./visitorDisplay";

const visitorSchema = z.object({
    unitId: z.string().min(1, "Unit is required"),
    visitorName: z.string().trim().min(1, "Visitor name is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    type: z.enum([
        "GUEST_VISITOR",
        "DELIVERY_RIDER",
        "COURIER_PARCEL",
        "SERVICE_PROVIDER",
        "MAINTENANCE_TECHNICIAN",
        "HOUSEKEEPING_CLEANER",
        "CONTRACTOR_WORKER",
        "DRIVER_PICKUP",
        "SECURITY_STAFF_EXTERNAL",
        "OTHER"
    ]),
    emiratesId: z.string().optional(),
    vehicleNumber: z.string().optional(),
    expectedArrivalAt: z.string().optional(),
    notes: z.string().optional()
});

type VisitorFormValues = z.infer<typeof visitorSchema>;

interface CreateVisitorSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    preselectedUnitId?: string;
}

export function CreateVisitorSheet({ open, onOpenChange, buildingId, preselectedUnitId }: CreateVisitorSheetProps) {
    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(buildingId, { enabled: open && !!buildingId });
    const { data: occupancies, isLoading: isOccupanciesLoading } = useBuildingOccupancies(buildingId, { enabled: open && !!buildingId });
    const createMutation = useCreateVisitor();

    const form = useForm<VisitorFormValues>({
        resolver: zodResolver(visitorSchema),
        defaultValues: {
            unitId: preselectedUnitId || "",
            visitorName: "",
            phoneNumber: "",
            type: "GUEST_VISITOR",
            emiratesId: "",
            vehicleNumber: "",
            expectedArrivalAt: "",
            notes: ""
        }
    });

    const selectedType = form.watch("type");
    const isGuestVisitor = selectedType === "GUEST_VISITOR";
    const selectedUnitId = form.watch("unitId");

    const activeOccupancyByUnitId = useMemo(() => {
        const map = new Map<string, BuildingOccupancy>();
        (occupancies || []).forEach((occ) => {
            const isActive = String(occ.status ?? "").toUpperCase() === "ACTIVE" || !occ.endAt;
            if (!isActive || !occ.unitId) return;
            if (!map.has(occ.unitId)) {
                map.set(occ.unitId, occ);
            }
        });
        return map;
    }, [occupancies]);

    const sortedOccupiedUnits = useMemo(() => {
        const list = [...(units || [])].filter((unit) => activeOccupancyByUnitId.has(unit.id));
        list.sort((a, b) =>
            String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { numeric: true, sensitivity: "base" })
        );
        return list;
    }, [units, activeOccupancyByUnitId]);

    const isUnitOptionsLoading = isUnitsLoading || isOccupanciesLoading;
    const hasOccupiedUnits = sortedOccupiedUnits.length > 0;

    const sortedVisitorTypes = useMemo(() => {
        const list = [...visitorTypes];
        list.sort((a, b) =>
            String(visitorTypeLabels[a] ?? a).localeCompare(String(visitorTypeLabels[b] ?? b), undefined, { sensitivity: "base" })
        );
        return list;
    }, []);

    const selectedUnit = useMemo(() => {
        if (!selectedUnitId) return null;
        return sortedOccupiedUnits.find((u) => u.id === selectedUnitId) ?? null;
    }, [selectedUnitId, sortedOccupiedUnits]);

    const activeOccupancy = useMemo(() => {
        if (!selectedUnitId) return null;
        return activeOccupancyByUnitId.get(selectedUnitId) ?? null;
    }, [activeOccupancyByUnitId, selectedUnitId]);

    useEffect(() => {
        if (!open) return;
        if (preselectedUnitId && activeOccupancyByUnitId.has(preselectedUnitId)) {
            form.setValue("unitId", preselectedUnitId);
            return;
        }
        if (preselectedUnitId && !activeOccupancyByUnitId.has(preselectedUnitId)) {
            form.setValue("unitId", "");
        }
    }, [open, preselectedUnitId, form, activeOccupancyByUnitId]);

    useEffect(() => {
        if (!selectedUnitId) return;
        if (activeOccupancyByUnitId.has(selectedUnitId)) return;
        form.setValue("unitId", "");
    }, [selectedUnitId, activeOccupancyByUnitId, form]);

    // If the user switches to Guest, clear expected arrival since it's hidden for that type.
    useEffect(() => {
        if (!open) return;
        if (!isGuestVisitor) return;
        form.setValue("expectedArrivalAt", "");
    }, [open, isGuestVisitor, form]);

    useEffect(() => {
        if (!open) {
            form.reset({
                unitId: preselectedUnitId || "",
                visitorName: "",
                phoneNumber: "",
                type: "GUEST_VISITOR",
                emiratesId: "",
                vehicleNumber: "",
                expectedArrivalAt: "",
                notes: ""
            });
        }
    }, [open, form, preselectedUnitId]);

    const onSubmit = async (data: VisitorFormValues) => {
        try {
            await createMutation.mutateAsync({
                buildingId,
                data: {
                    unitId: data.unitId,
                    visitorName: data.visitorName,
                    phoneNumber: data.phoneNumber,
                    type: data.type as VisitorType,
                    emiratesId: data.emiratesId || undefined,
                    vehicleNumber: data.vehicleNumber || undefined,
                    expectedArrivalAt: data.type === "GUEST_VISITOR" ? undefined : (data.expectedArrivalAt || undefined),
                    notes: data.notes || undefined
                }
            });
            toast.success("Visitor registered successfully");
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to register visitor");
            console.error(error);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Register Visitor"
            description="Add a new visitor to the building"
            width="w-[520px] sm:w-[760px]"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="unitId"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel className="flex items-center gap-2">
                                            <Home className="h-4 w-4 text-zinc-400" />
                                            Unit
                                        </FormLabel>
                                        <FormControl>
                                            <VirtualizedUnitSelect
                                                units={sortedOccupiedUnits as BuildingUnit[]}
                                                selectedId={field.value}
                                                onSelect={field.onChange}
                                                isLoading={isUnitOptionsLoading}
                                                emptyMessage="No occupied units."
                                                disabled={!hasOccupiedUnits && !isUnitOptionsLoading}
                                                placeholder={hasOccupiedUnits ? "Search occupied unit..." : "No occupied units"}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        <p className="text-xs text-zinc-500">Only occupied units are available for visitor registration.</p>

                                        {selectedUnit ? (
                                            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-xs">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium text-zinc-700">Unit</span>
                                                    <span className="text-zinc-600">{selectedUnit.label}</span>
                                                </div>
                                                {typeof selectedUnit.floor === "number" ? (
                                                    <div className="mt-1 flex items-center justify-between gap-2">
                                                        <span className="text-zinc-500">Floor</span>
                                                        <span className="text-zinc-600">{selectedUnit.floor}</span>
                                                    </div>
                                                ) : null}
                                                <div className="mt-2 border-t border-zinc-200 pt-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-medium text-zinc-700">Resident</span>
                                                        <span className="text-zinc-600">
                                                            {activeOccupancy?.residentName ||
                                                                activeOccupancy?.resident?.name ||
                                                                activeOccupancy?.residentEmail ||
                                                                activeOccupancy?.resident?.email ||
                                                                "Vacant"}
                                                        </span>
                                                    </div>
                                                    {(activeOccupancy?.residentEmail || activeOccupancy?.resident?.email) ? (
                                                        <div className="mt-1 text-zinc-500">
                                                            {activeOccupancy?.residentEmail || activeOccupancy?.resident?.email}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel>Visitor Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {sortedVisitorTypes.map((type) => (
                                                    <SelectItem key={type} value={type}>
                                                        {visitorTypeLabels[type]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="visitorName"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-zinc-400" />
                                            Visitor Name
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="Full name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-zinc-400" />
                                            Phone Number
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="+971..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="emiratesId"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-zinc-400" />
                                            Emirates ID (Optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="784-XXXX-XXXXXXX-X" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vehicleNumber"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-1">
                                        <FormLabel className="flex items-center gap-2">
                                            <Car className="h-4 w-4 text-zinc-400" />
                                            Vehicle Number (Optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="ABC 1234" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {!isGuestVisitor ? (
                                <FormField
                                    control={form.control}
                                    name="expectedArrivalAt"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-1">
                                            <FormLabel className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-zinc-400" />
                                                Expected Arrival (Optional)
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="datetime-local" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : null}

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Any additional information..."
                                                className="resize-none"
                                                rows={5}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 p-4 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || isUnitOptionsLoading || !hasOccupiedUnits}>
                            {createMutation.isPending ? "Registering..." : "Register Visitor"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
