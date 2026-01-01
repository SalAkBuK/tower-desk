"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePlatformOrgAdmin, usePlatformOrgs } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const adminSchema = z.object({
    orgId: z.string().trim().min(1, "Organization ID is required"),
    name: z.string().trim().min(2, "Admin name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

type AdminFormValues = z.infer<typeof adminSchema>;

export type CreatedOrgAdmin = {
    orgId: string;
    userId: string;
    email: string;
    tempPassword?: string;
    mustChangePassword?: boolean;
};

interface CreateOrgAdminSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultOrgId?: string;
    onCreated?: (admin: CreatedOrgAdmin) => void;
}

export function CreateOrgAdminSheet({ open, onOpenChange, defaultOrgId, onCreated }: CreateOrgAdminSheetProps) {
    const createAdmin = useCreatePlatformOrgAdmin();
    const { data: orgs, isLoading: isOrgsLoading, error: orgsError } = usePlatformOrgs();
    const [error, setError] = useState<string | null>(null);

    const form = useForm<AdminFormValues>({
        resolver: zodResolver(adminSchema),
        defaultValues: {
            orgId: defaultOrgId || "",
            name: "",
            email: "",
            password: "",
        },
    });

    useEffect(() => {
        if (!open) return;
        setError(null);
        form.reset({
            orgId: defaultOrgId || "",
            name: "",
            email: "",
            password: "",
        });
    }, [open, defaultOrgId, form]);

    useEffect(() => {
        if (!open) return;
        if (defaultOrgId) return;
        if (!orgs || orgs.length === 0) return;
        const currentOrgId = form.getValues("orgId");
        if (!currentOrgId) {
            form.setValue("orgId", orgs[0].id);
        }
    }, [open, orgs, defaultOrgId, form]);

    const onSubmit = async (data: AdminFormValues) => {
        setError(null);
        try {
            if (!data.orgId) {
                form.setError("orgId", { message: "Select an organization first." });
                return;
            }
            const result = await createAdmin.mutateAsync({
                orgId: data.orgId.trim(),
                name: data.name.trim(),
                email: data.email.trim(),
                password: data.password?.trim() || undefined,
            });
            const created = {
                orgId: data.orgId.trim(),
                userId: result.userId,
                email: result.email,
                tempPassword: result.tempPassword,
                mustChangePassword: result.mustChangePassword,
            };
            onCreated?.(created);
            toast.success("Organization admin created");
            onOpenChange(false);
            form.reset();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create org admin";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create Organization Admin"
            description="Create the first admin for the organization."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
                    <FormField
                        control={form.control}
                        name="orgId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isOrgsLoading ? "Loading orgs..." : "Select an organization"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {isOrgsLoading ? (
                                            <SelectItem value="loading" disabled>
                                                Loading orgs...
                                            </SelectItem>
                                        ) : orgs && orgs.length > 0 ? (
                                            orgs.map((org) => (
                                                <SelectItem key={org.id} value={org.id}>
                                                    {org.name}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="none" disabled>
                                                No organizations available
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Admin Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Jane Admin" {...field} />
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
                                    <Input type="email" placeholder="jane@org.com" {...field} />
                                </FormControl>
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
                                    <Input type="password" placeholder="******" {...field} />
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
                    {orgsError ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {orgsError instanceof Error ? orgsError.message : "Failed to load organizations."}
                        </div>
                    ) : null}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createAdmin.isPending || !form.watch("orgId")}>
                            {createAdmin.isPending ? "Creating..." : "Create Admin"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
