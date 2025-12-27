"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateBuildingUnit } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const unitSchema = z.object({
    label: z.string().trim().min(1, "Unit label is required"),
    floor: z.number().int().min(1, "Floor must be at least 1").optional(),
    notes: z.string().trim().optional().or(z.literal("")),
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface CreateUnitSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
}

export function CreateUnitSheet({ open, onOpenChange, buildingId }: CreateUnitSheetProps) {
    const createUnit = useCreateBuildingUnit();
    const [error, setError] = useState<string | null>(null);

    const form = useForm<UnitFormValues>({
        resolver: zodResolver(unitSchema),
        defaultValues: {
            label: "",
            floor: undefined,
            notes: "",
        },
    });

    useEffect(() => {
        if (open) {
            setError(null);
            form.reset({ label: "", floor: undefined, notes: "" });
        }
    }, [open, form]);

    const onSubmit = async (data: UnitFormValues) => {
        setError(null);
        try {
            await createUnit.mutateAsync({
                buildingId,
                data: {
                    label: data.label.trim(),
                    floor: data.floor,
                    notes: data.notes?.trim() || undefined,
                },
            });
            toast.success("Unit added");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to add unit";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Add Unit"
            description="Create a new unit for this building."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="label"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Label</FormLabel>
                                <FormControl>
                                    <Input placeholder="101" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="floor"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Floor (Optional)</FormLabel>
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
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Corner unit" {...field} />
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
                        <Button type="submit" disabled={createUnit.isPending}>
                            {createUnit.isPending ? "Adding..." : "Add Unit"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
