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
import { BaseRole, Role } from "@/lib/types";
import { useBuildingUnits, useCreateUser, useRoles, useSetUserRoles } from "@/lib/queries";

/**
 * CreateUserSheet - User Provisioning
 *
 * - Role dropdown includes base roles and custom role templates.
 * - Base roles drive assignment grants (building/unit).
 * - Custom role templates are assigned after provisioning.
 */

const userSchema = z.object({
    role: z.string().trim().min(1, "Role is required"),
    assignmentType: z.enum(['admin', 'manager', 'tenant', 'employee']).optional(),
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    // Password might be auto-generated or required? API example has it.
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal('')),
    buildingId: z.string().trim().optional(),
    buildingIds: z.array(z.string().trim()).optional(),
    roleTemplateIds: z.array(z.string().trim()).optional(),
    unitId: z.string().trim().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    tenant: "Tenant",
    employee: "Maintenance Staff"
};

const baseRoleKeys = new Set<BaseRole>(['admin', 'manager', 'tenant', 'employee']);

const isBaseRole = (value: string) => baseRoleKeys.has(value as BaseRole);

const TEMPLATE_PREFIX = "template:";
const toTemplateValue = (id: string) => `${TEMPLATE_PREFIX}${id}`;
const fromTemplateValue = (value: string) => value.startsWith(TEMPLATE_PREFIX) ? value.slice(TEMPLATE_PREFIX.length) : null;

// Helper functions to identify role types with flexible matching
const isAdminRole = (role: string) => {
    const normalized = role.toLowerCase();
    return normalized === 'admin' || normalized === 'org_admin';
};

const isTenantRole = (role: string) => {
    const normalized = role.toLowerCase();
    return normalized === 'tenant' || normalized === 'resident';
};

const isManagerRole = (role: string) => {
    const normalized = role.toLowerCase();
    return normalized === 'manager';
};

const isEmployeeRole = (role: string) => {
    const normalized = role.toLowerCase();
    return normalized === 'employee' || normalized === 'maintenance_staff';
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
    const setUserRoles = useSetUserRoles();
    const defaultRoleValue = (defaultRole === 'superadmin' ? 'admin' : defaultRole) as Role;
    const initialRole = hideAdminRole && defaultRoleValue === 'admin' ? 'manager' : defaultRoleValue;

    // Fetch role templates (permission sets) to auto-assign based on selected base role
    const { data: roleTemplates } = useRoles({ enabled: open });

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            role: initialRole as any, // prevent superadmin creation
            assignmentType: initialRole as any,
            fullName: "",
            email: "",
            password: "",
            buildingId: defaultBuildingId || "",
            buildingIds: [],
            roleTemplateIds: [],
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
                assignmentType: initialRole as any,
                fullName: "",
                email: "",
                password: "",
                buildingId: initialBuildingId,
                buildingIds: [],
                roleTemplateIds: [],
                unitId: "",
            });
        }
    }, [open, defaultRole, form, defaultBuildingId, buildingOptions, initialRole]);

    const selectedRole = form.watch("role");
    const selectedAssignmentType = form.watch("assignmentType");
    const selectedBuildingId = form.watch("buildingId");
    const selectedTemplateId = selectedRole ? fromTemplateValue(selectedRole) : null;
    const assignmentRole: BaseRole = isBaseRole(selectedRole)
        ? (selectedRole as BaseRole)
        : (selectedAssignmentType ?? 'manager');
    const requiresBuilding = requireBuildingAssignment
        && (isAdminRole(assignmentRole) || isManagerRole(assignmentRole) || isTenantRole(assignmentRole) || isEmployeeRole(assignmentRole));
    const showBuildingSelect = requiresBuilding && buildingOptions.length > 0;
    const shouldLoadUnits = isTenantRole(assignmentRole) && Boolean(selectedBuildingId);
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
    const roleTemplateOptions = useMemo(() => {
        return (roleTemplates || [])
            .map((roleEntry) => ({
                id: String(roleEntry.id ?? roleEntry.key ?? roleEntry.name ?? ''),
                key: String(roleEntry.key ?? roleEntry.id ?? roleEntry.name ?? ''),
                name: roleEntry.name ?? roleEntry.key ?? "Role",
                description: roleEntry.description,
            }))
            .filter((roleEntry) => roleEntry.id);
    }, [roleTemplates]);
    const roleTemplateKeyById = useMemo(() => {
        return new Map(roleTemplateOptions.map((entry) => [entry.id, entry.key]));
    }, [roleTemplateOptions]);

    useEffect(() => {
        if (!open || !selectedTemplateId) return;
        const currentTemplates = form.getValues('roleTemplateIds') || [];
        if (!currentTemplates.includes(selectedTemplateId)) {
            form.setValue('roleTemplateIds', [...currentTemplates, selectedTemplateId]);
        }
    }, [open, selectedTemplateId, form]);

    useEffect(() => {
        if (!open) return;
        if (selectedTemplateId) return;
        const currentTemplates = form.getValues('roleTemplateIds') || [];
        if (currentTemplates.length > 0) {
            form.setValue('roleTemplateIds', []);
        }
    }, [open, selectedTemplateId, form]);

    useEffect(() => {
        if (!open) return;
        if (!selectedTemplateId) return;
        if (selectedAssignmentType) return;
        form.setValue('assignmentType', initialRole as BaseRole);
    }, [open, selectedTemplateId, selectedAssignmentType, initialRole, form]);

    useEffect(() => {
        if (!open) return;
        if (!isAdminRole(assignmentRole)) {
            form.setValue("buildingIds", []);
        }
        if (!isTenantRole(assignmentRole)) {
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
    }, [open, assignmentRole, unitOptions, form]);

    const onSubmit = async (data: UserFormValues) => {
        try {
            const selectedRoleValue = lockRole ? (defaultRole === 'superadmin' ? 'admin' : defaultRole) : data.role;
            const templateId = fromTemplateValue(selectedRoleValue);
            const selectedRoleTemplate = templateId
                ? roleTemplateOptions.find((entry) => entry.id === templateId)
                : null;
            const assignmentType = isBaseRole(selectedRoleValue)
                ? (selectedRoleValue as BaseRole)
                : (data.assignmentType ?? 'manager');
            if (!isBaseRole(selectedRoleValue) && !data.assignmentType) {
                form.setError("assignmentType", { message: "Assignment type is required" });
                return;
            }

            const needsBuilding = requireBuildingAssignment && (isManagerRole(assignmentType) || isTenantRole(assignmentType) || isEmployeeRole(assignmentType));
            const needsAdminBuildings = requireBuildingAssignment && isAdminRole(assignmentType);
            if (needsBuilding && !data.buildingId) {
                form.setError("buildingId", { message: "Building is required" });
                return;
            }
            if (needsAdminBuildings && (!data.buildingIds || data.buildingIds.length === 0)) {
                form.setError("buildingIds", { message: "Select at least one building" });
                return;
            }
            if (isTenantRole(assignmentType) && !data.unitId) {
                form.setError("unitId", { message: "Unit is required" });
                return;
            }

            const selectedRoleTemplateIds = Array.from(new Set(data.roleTemplateIds ?? [])).filter(Boolean);
            const selectedRoleTemplateKeys = selectedRoleTemplateIds
                .map((id) => roleTemplateKeyById.get(id))
                .filter((key): key is string => Boolean(key));
            const primaryRoleKey = selectedRoleTemplate?.key ?? selectedRoleTemplateKeys[0];
            const roleForProvision = isBaseRole(selectedRoleValue)
                ? selectedRoleValue
                : (primaryRoleKey ?? templateId ?? selectedRoleValue);

            const createdUser = await createUser.mutateAsync({
                role: roleForProvision,
                data: {
                    fullName: data.fullName,
                    email: data.email,
                    password: data.password || undefined, // Only send if provided
                    buildingId: data.buildingId || undefined,
                    buildingIds: data.buildingIds,
                    unitId: isTenantRole(assignmentType) ? data.unitId : undefined,
                    assignmentType: assignmentType,
                    orgRoleKeys: selectedRoleTemplateKeys
                }
            });
            if (selectedRoleTemplateIds.length > 0) {
                const createdUserId = createdUser?.id ? String(createdUser.id) : "";
                if (!createdUserId) {
                    toast.error("User created, but role templates could not be assigned.");
                } else {
                    try {
                        await setUserRoles.mutateAsync({
                            userId: createdUserId,
                            roleIds: selectedRoleTemplateIds,
                            mode: "replace",
                        });
                    } catch (error) {
                        toast.error("User created, but role templates could not be assigned.");
                        console.error(error);
                    }
                }
            }
            const roleLabel = isBaseRole(selectedRoleValue)
                ? (roleLabels[selectedRoleValue] ?? selectedRoleValue)
                : (selectedRoleTemplate?.name ?? selectedRoleTemplate?.key ?? templateId ?? selectedRoleValue);
            toast.success(`${roleLabel} created successfully`);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast.error("Failed to create user");
            console.error(error);
        }
    };

    const isSaving = createUser.isPending || setUserRoles.isPending;

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
                                                            {roleTemplateOptions.length > 0 ? (
                                                                <SelectItem value="template-divider" disabled>
                                                                    Role Templates
                                                                </SelectItem>
                                                            ) : null}
                                                            {roleTemplateOptions.map((template) => (
                                                                <SelectItem key={template.id} value={toTemplateValue(template.id)}>
                                                                    {template.name}
                                                                </SelectItem>
                                                            ))}
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

                        {selectedTemplateId && (
                            <FormField
                                control={form.control}
                                name="assignmentType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assignment Type</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <UserRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger className="pl-9">
                                                        <SelectValue placeholder="Select assignment type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {!hideAdminRole ? <SelectItem value="admin">Admin</SelectItem> : null}
                                                        <SelectItem value="manager">Manager</SelectItem>
                                                        <SelectItem value="tenant">Tenant</SelectItem>
                                                        <SelectItem value="employee">Maintenance Staff</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {requiresBuilding && isAdminRole(assignmentRole) && (
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

                        {requiresBuilding && !isAdminRole(assignmentRole) && (
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
                                                    <Select onValueChange={field.onChange} value={field.value}>
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

                        {isTenantRole(assignmentRole) && (
                            <FormField
                                control={form.control}
                                name="unitId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Home className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isUnitsLoading}>
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
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? "Saving..." : "Create User"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </SlideOver>
    );
}

