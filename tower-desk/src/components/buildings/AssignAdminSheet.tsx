"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssignAdmin, useUsers } from "@/lib/queries";
import { hasCanonicalRole } from "@/lib/roles";
import { toast } from "sonner";
import { useEffect } from "react";

const assignSchema = z.object({
    adminId: z.string().min(1, "Please select an admin"),
});

type AssignFormValues = z.infer<typeof assignSchema>;

interface AssignAdminSheetProps {
    buildingId: string;
    buildingName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AssignAdminSheet({ buildingId, buildingName, open, onOpenChange }: AssignAdminSheetProps) {
    const assignAdmin = useAssignAdmin();
    const { data: users, isLoading: isLoadingUsers } = useUsers();

    const admins = users?.filter((u) => hasCanonicalRole(u, 'admin')) || [];

    const form = useForm<AssignFormValues>({
        resolver: zodResolver(assignSchema),
        defaultValues: {
            adminId: "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({ adminId: "" });
        }
    }, [open, form]);

    const onSubmit = async (data: AssignFormValues) => {
        try {
            await assignAdmin.mutateAsync({ buildingId, adminId: data.adminId });
            toast.success("Admin assigned successfully");
            onOpenChange(false);
            form.reset();
        } catch {
            toast.error("Failed to assign admin");
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title={`Assign Admin to ${buildingName}`}
            description="Select an administrator to manage this building."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">

                    <FormField
                        control={form.control}
                        name="adminId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Select Admin</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an admin..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {isLoadingUsers ? (
                                            <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                        ) : (
                                            admins.map(admin => (
                                                <SelectItem key={admin.id} value={admin.id}>
                                                    {admin.name} ({admin.email})
                                                </SelectItem>
                                            ))
                                        )}
                                        {admins.length === 0 && !isLoadingUsers && (
                                            <SelectItem value="none" disabled>No admins found</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={assignAdmin.isPending}>
                            {assignAdmin.isPending ? "Assigning..." : "Assign Admin"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
