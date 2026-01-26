"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { User, Phone, Car, Clock, Home, CreditCard } from "lucide-react";

import { SlideOver } from "@/components/common/SlideOver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateVisitor, useBuildingUnits } from "@/lib/queries";
import { VisitorType, BuildingUnit } from "@/lib/types";
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
    const { data: units } = useBuildingUnits(buildingId, { enabled: !!buildingId });
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

    useEffect(() => {
        if (open && preselectedUnitId) {
            form.setValue("unitId", preselectedUnitId);
        }
    }, [open, preselectedUnitId, form]);

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
                    expectedArrivalAt: data.expectedArrivalAt || undefined,
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
            width="w-[400px] sm:w-[480px]"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        <FormField
                            control={form.control}
                            name="unitId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Home className="h-4 w-4 text-zinc-400" />
                                        Unit
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select unit" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {units?.map((unit: BuildingUnit) => (
                                                <SelectItem key={unit.id} value={unit.id}>
                                                    {unit.label}
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
                                <FormItem>
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
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Visitor Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {visitorTypes.map((type) => (
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
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
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
                                <FormItem>
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
                            name="expectedArrivalAt"
                            render={({ field }) => (
                                <FormItem>
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

                        <FormField
                            control={form.control}
                            name="vehicleNumber"
                            render={({ field }) => (
                                <FormItem>
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

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Any additional information..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="border-t border-zinc-200 p-4 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? "Registering..." : "Register Visitor"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
