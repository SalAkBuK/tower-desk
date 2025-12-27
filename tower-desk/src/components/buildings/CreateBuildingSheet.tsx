"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAssignAdmin, useCreateBuilding } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect } from "react";

const buildingSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    city: z.string().trim().min(2, "City is required"),
    emirate: z.string().trim().optional().or(z.literal("")),
    country: z.string().trim().regex(/^[A-Za-z]{3}$/, "Country must be a 3-letter code").optional().or(z.literal("")),
    timezone: z.string().trim().optional().or(z.literal("")),
    floors: z.number().int().min(1, "Floors must be at least 1").optional(),
    unitsCount: z.number().int().min(1, "Units must be at least 1").optional(),
});

type BuildingFormValues = z.infer<typeof buildingSchema>;

interface CreateBuildingSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assignToAdminId?: string;
    onAssigned?: (buildingId: string) => void;
}

export function CreateBuildingSheet({ open, onOpenChange, assignToAdminId, onAssigned }: CreateBuildingSheetProps) {
    const createBuilding = useCreateBuilding();
    const assignAdmin = useAssignAdmin();

    const form = useForm<BuildingFormValues>({
        resolver: zodResolver(buildingSchema),
        defaultValues: {
            name: "",
            city: "",
            emirate: "",
            country: "ARE",
            timezone: "Asia/Dubai",
            floors: undefined,
            unitsCount: undefined,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: "",
                city: "",
                emirate: "",
                country: "ARE",
                timezone: "Asia/Dubai",
                floors: undefined,
                unitsCount: undefined,
            });
        }
    }, [open, form]);

    const onSubmit = async (data: BuildingFormValues) => {
        try {
            const payload = {
                name: data.name.trim(),
                city: data.city.trim(),
                emirate: data.emirate?.trim() || undefined,
                country: data.country?.trim().toUpperCase() || undefined,
                timezone: data.timezone?.trim() || undefined,
                floors: data.floors,
                unitsCount: data.unitsCount,
            };
            const building = await createBuilding.mutateAsync(payload);
            if (assignToAdminId) {
                try {
                    await assignAdmin.mutateAsync({ buildingId: building.id, adminId: assignToAdminId });
                    onAssigned?.(building.id);
                    toast.success("Building created and assigned");
                } catch (error) {
                    toast.error("Building created but assignment failed");
                    console.error(error);
                    onOpenChange(false);
                    form.reset();
                    return;
                }
            } else {
                toast.success("Building created successfully");
            }
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast.error("Failed to create building");
            console.error(error);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create New Building"
            description="Add a new building to the system."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Building Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Tower One" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl>
                                        <Input placeholder="New York" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="emirate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Emirate (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Dubai" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Country (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ARE" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="timezone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Timezone (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Asia/Dubai" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="unitsCount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Units Count (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="floors"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Floors (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(value === "" ? undefined : Number(value));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createBuilding.isPending}>
                            {createBuilding.isPending ? "Creating..." : "Create Building"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
