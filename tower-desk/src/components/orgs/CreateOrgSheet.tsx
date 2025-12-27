"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreatePlatformOrg } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const orgSchema = z.object({
    name: z.string().trim().min(2, "Organization name must be at least 2 characters"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export type CreatedOrg = {
    id: string;
    name: string;
    createdAt?: string;
};

interface CreateOrgSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (org: CreatedOrg) => void;
}

export function CreateOrgSheet({ open, onOpenChange, onCreated }: CreateOrgSheetProps) {
    const createOrg = useCreatePlatformOrg();
    const [error, setError] = useState<string | null>(null);

    const form = useForm<OrgFormValues>({
        resolver: zodResolver(orgSchema),
        defaultValues: {
            name: "",
        },
    });

    useEffect(() => {
        if (open) {
            setError(null);
            form.reset({ name: "" });
        }
    }, [open, form]);

    const onSubmit = async (data: OrgFormValues) => {
        setError(null);
        try {
            const created = await createOrg.mutateAsync({ name: data.name.trim() });
            onCreated?.(created);
            toast.success("Organization created");
            onOpenChange(false);
            form.reset();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create organization";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create Organization"
            description="Set up a new organization before creating its admin."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="TowerDesk Holdings" {...field} />
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
                        <Button type="submit" disabled={createOrg.isPending}>
                            {createOrg.isPending ? "Creating..." : "Create Org"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
