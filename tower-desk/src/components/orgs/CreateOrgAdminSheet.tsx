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
import { UserPlus, Building2, KeyRound, Mail } from "lucide-react";

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
            width="w-full sm:w-[600px] lg:w-[680px]"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900">Organization Access</h3>
                                <p className="text-xs text-zinc-500">Choose the org and assign a primary admin.</p>
                            </div>
                        </div>
                        <div className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="orgId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Organization</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11">
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
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900">Admin Identity</h3>
                                <p className="text-xs text-zinc-500">Create the credentials for the first admin.</p>
                            </div>
                        </div>
                        <div className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Admin Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jane Admin" {...field} className="h-11" />
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
                                                <Input type="email" placeholder="jane@org.com" {...field} className="h-11 pl-9" />
                                            </div>
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
                                        <FormLabel>
                                            Password <span className="text-zinc-400 font-normal">(Optional)</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                <Input type="password" placeholder="Auto-generate if left blank" {...field} className="h-11 pl-9" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}
                    {orgsError ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {orgsError instanceof Error ? orgsError.message : "Failed to load organizations."}
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createAdmin.isPending || !form.watch("orgId")} className="gap-2">
                            {createAdmin.isPending ? "Creating..." : "Create Admin"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
