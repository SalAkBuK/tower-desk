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
    name: z.string().min(2, "Name must be at least 2 characters"),
    address: z.string().min(5, "Address must be at least 5 characters"),
    city: z.string().min(2, "City is required"),
    unitsCount: z.number().int().min(1, "Must have at least 1 unit"),
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
            address: "",
            city: "",
            unitsCount: 1,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: "",
                address: "",
                city: "",
                unitsCount: 1,
            });
        }
    }, [open, form]);

    const onSubmit = async (data: BuildingFormValues) => {
        try {
            const building = await createBuilding.mutateAsync(data);
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

                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                    <Input placeholder="123 Main St" {...field} />
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
                            name="unitsCount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Units Count</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
