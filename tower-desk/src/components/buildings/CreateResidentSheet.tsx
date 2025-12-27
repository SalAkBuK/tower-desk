"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingUnits, useCreateBuildingResident } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

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
    const createResident = useCreateBuildingResident();
    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(buildingId, {
        available: true,
        enabled: open,
    });
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        if (open) {
            setError(null);
            form.reset({
                name: "",
                email: "",
                password: "",
                unitId: unitOptions[0]?.id || "",
            });
        }
    }, [open, form, unitOptions]);

    const onSubmit = async (data: ResidentFormValues) => {
        setError(null);
        try {
            await createResident.mutateAsync({
                buildingId,
                data: {
                    name: data.name.trim(),
                    email: data.email.trim(),
                    password: data.password?.trim() || undefined,
                    unitId: data.unitId,
                },
            });
            toast.success("Resident created");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create resident";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Add Resident"
            description="Create a resident and link them to a unit."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Resident Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="John Doe" {...field} />
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
                                    <Input type="email" placeholder="resident@example.com" {...field} />
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
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isUnitsLoading}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isUnitsLoading ? "Loading units..." : "Select a unit"} />
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
                                <FormLabel>Password (Optional)</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="********" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createResident.isPending || unitOptions.length === 0}>
                            {createResident.isPending ? "Creating..." : "Add Resident"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
