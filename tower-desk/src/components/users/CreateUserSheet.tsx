"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo } from "react";
import { Building2, Home, Lock, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Role } from "@/lib/types";
import { useBuildingUnits, useCreateUser } from "@/lib/queries";

// Schema based on Admin API but applied generally
const userSchema = z.object({
    role: z.enum(['admin', 'manager', 'tenant', 'employee']),
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    // Password might be auto-generated or required? API example has it.
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal('')),
    buildingId: z.string().trim().optional(),
    buildingIds: z.array(z.string().trim()).optional(),
    unitId: z.string().trim().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    tenant: "Tenant",
    employee: "Maintenance Staff"
};

interface CreateUserSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultRole?: Role;
    lockRole?: boolean;
    hideAdminRole?: boolean;
    buildingOptions?: { id: string; name: string }[];
    defaultBuildingId?: string;
    requireBuildingAssignment?: boolean;
}

export function CreateUserSheet({
    open,
    onOpenChange,
    defaultRole = 'admin',
    lockRole = false,
    hideAdminRole = false,
    buildingOptions = [],
    defaultBuildingId,
    requireBuildingAssignment = false
}: CreateUserSheetProps) {
    const createUser = useCreateUser();
    const defaultRoleValue = (defaultRole === 'superadmin' ? 'admin' : defaultRole) as Role;
    const initialRole = hideAdminRole && defaultRoleValue === 'admin' ? 'manager' : defaultRoleValue;

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            role: initialRole as any, // prevent superadmin creation
            fullName: "",
            email: "",
            password: "",
            buildingId: defaultBuildingId || "",
            buildingIds: [],
            unitId: "",
        },
    });

    // Reset form when role or open changes
    useEffect(() => {
        if (open) {
            const initialBuildingId = defaultBuildingId && buildingOptions.some((b) => b.id === defaultBuildingId)
                ? defaultBuildingId
                : (buildingOptions[0]?.id || "");
            form.reset({
                role: initialRole as any,
                fullName: "",
                email: "",
                password: "",
                buildingId: initialBuildingId,
                buildingIds: [],
                unitId: "",
            });
        }
    }, [open, defaultRole, form, defaultBuildingId, buildingOptions, initialRole]);

    const selectedRole = form.watch("role");
    const selectedBuildingId = form.watch("buildingId");
    const requiresBuilding = requireBuildingAssignment && (selectedRole === 'admin' || selectedRole === 'manager' || selectedRole === 'tenant' || selectedRole === 'employee');
    const showBuildingSelect = requiresBuilding && buildingOptions.length > 0;
    const shouldLoadUnits = selectedRole === 'tenant' && Boolean(selectedBuildingId);
    const { data: units, isLoading: isUnitsLoading } = useBuildingUnits(selectedBuildingId || "", {
        available: true,
        enabled: shouldLoadUnits,
    });
    const unitOptions = useMemo(() => {
        return (units || []).map((unit) => ({
            id: unit.id,
            label: unit.label,
        }));
    }, [units]);

    useEffect(() => {
        if (!open) return;
        if (selectedRole !== 'admin') {
            form.setValue("buildingIds", []);
        }
        if (selectedRole !== 'tenant') {
            form.setValue("unitId", "");
            return;
        }
        if (!unitOptions.length) {
            form.setValue("unitId", "");
            return;
        }
        const currentUnitId = form.getValues("unitId");
        if (!currentUnitId || !unitOptions.some((unit) => unit.id === currentUnitId)) {
            form.setValue("unitId", unitOptions[0].id);
        }
    }, [open, selectedRole, unitOptions, form]);

    const onSubmit = async (data: UserFormValues) => {
        try {
            const roleValue = lockRole ? (defaultRole === 'superadmin' ? 'admin' : defaultRole) : data.role;
            const needsBuilding = requireBuildingAssignment && (roleValue === 'manager' || roleValue === 'tenant' || roleValue === 'employee');
            const needsAdminBuildings = requireBuildingAssignment && roleValue === 'admin';
            if (needsBuilding && !data.buildingId) {
                form.setError("buildingId", { message: "Building is required" });
                return;
            }
            if (needsAdminBuildings && (!data.buildingIds || data.buildingIds.length === 0)) {
                form.setError("buildingIds", { message: "Select at least one building" });
                return;
            }
            if (roleValue === 'tenant' && !data.unitId) {
                form.setError("unitId", { message: "Unit is required" });
                return;
            }
            await createUser.mutateAsync({
                role: roleValue,
                data: {
                    fullName: data.fullName,
                    email: data.email,
                    password: data.password || undefined, // Only send if provided
                    buildingId: data.buildingId || undefined,
                    buildingIds: data.buildingIds,
                    unitId: roleValue === 'tenant' ? data.unitId : undefined
                }
            });
            toast.success(`${roleValue} created successfully`);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast.error("Failed to create user");
            console.error(error);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create New User"
            description="Add a new user to the system. Select the role carefully."
            width="w-full sm:w-[720px] lg:w-[860px]"
        >
            <div className="px-2 sm:px-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="space-y-6 p-1">
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Access & Assignment</div>
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <UserRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={lockRole}>
                                                <SelectTrigger className="pl-9">
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {lockRole ? (
                                                        <SelectItem value={field.value}>{roleLabels[field.value] ?? field.value}</SelectItem>
                                                    ) : (
                                                        <>
                                                            {!hideAdminRole ? <SelectItem value="admin">Admin</SelectItem> : null}
                                                            <SelectItem value="manager">Manager</SelectItem>
                                                            <SelectItem value="tenant">Tenant</SelectItem>
                                                            <SelectItem value="employee">Maintenance Staff</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {requiresBuilding && selectedRole === 'admin' && (
                            <FormField
                                control={form.control}
                                name="buildingIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assign Buildings</FormLabel>
                                        {showBuildingSelect ? (
                                            <FormControl>
                                                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                                                        <Building2 className="h-3.5 w-3.5" />
                                                        Select all buildings this admin should manage.
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {buildingOptions.map((building) => {
                                                            const checked = (field.value || []).includes(building.id);
                                                            return (
                                                                <label
                                                                    key={building.id}
                                                                    className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={(event) => {
                                                                            const next = new Set(field.value || []);
                                                                            if (event.target.checked) {
                                                                                next.add(building.id);
                                                                            } else {
                                                                                next.delete(building.id);
                                                                            }
                                                                            field.onChange(Array.from(next));
                                                                        }}
                                                                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                                                    />
                                                                    <span>{building.name}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </FormControl>
                                        ) : (
                                            <div className="text-sm text-amber-600">
                                                No buildings available to assign.
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {requiresBuilding && selectedRole !== 'admin' && (
                            <FormField
                                control={form.control}
                                name="buildingId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assign Building</FormLabel>
                                        {showBuildingSelect ? (
                                            <FormControl>
                                                <div className="relative">
                                                    <Building2 className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger className="pl-9">
                                                            <SelectValue placeholder="Select a building" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {buildingOptions.map((building) => (
                                                                <SelectItem key={building.id} value={building.id}>
                                                                    {building.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </FormControl>
                                        ) : (
                                            <div className="text-sm text-amber-600">
                                                No buildings available to assign.
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {selectedRole === 'tenant' && (
                            <FormField
                                control={form.control}
                                name="unitId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Home className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isUnitsLoading}>
                                                    <SelectTrigger className="pl-9">
                                                        <SelectValue placeholder={isUnitsLoading ? "Loading units..." : "Select a unit"} />
                                                    </SelectTrigger>
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
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Identity</div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="fullName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <UserRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Input placeholder="John Doe" {...field} autoComplete="off" className="pl-9" />
                                            </div>
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
                                                <Mail className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Input
                                                    placeholder="john@example.com"
                                                    type="email"
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    {...field}
                                                    className="pl-9"
                                                />
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
                                                <Lock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Input type="password" placeholder="******" autoComplete="new-password" {...field} className="pl-9" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createUser.isPending}>
                                {createUser.isPending ? "Creating..." : "Create User"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </SlideOver>
    );
}
