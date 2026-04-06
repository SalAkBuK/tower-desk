"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Building2, Home, KeyRound, Lock, Mail, Plus, Trash2, UserRound } from "lucide-react";

import { SlideOver } from "@/components/common/SlideOver";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingUnits, useProvisionUser, useRoleTemplates } from "@/lib/queries";
import type { ProvisionUserPayload, ProvisionUserResponse } from "@/lib/api/users";
import { isPrimaryOrgAccessRoleDefinition, toCanonicalRole } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { getUserAccessView, normalizeUserFromApi } from "@/lib/userAccess";

const assignmentSchema = z.object({
    buildingId: z.string().trim().min(1, "Building is required"),
    type: z.enum(["BUILDING_ADMIN", "MANAGER", "STAFF"]),
});

const formSchema = z.object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
    sendInvite: z.boolean().default(true),
    orgAccessRoleId: z.string().trim().optional(),
    buildingAssignments: z.array(assignmentSchema).default([]),
    residentEnabled: z.boolean().default(false),
    residentBuildingId: z.string().trim().optional(),
    residentUnitId: z.string().trim().optional(),
    residentMode: z.enum(["ADD", "MOVE", "MOVE_OUT"]).default("ADD"),
}).superRefine((values, ctx) => {
    if (!values.residentEnabled) return;
    if (!values.residentBuildingId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["residentBuildingId"], message: "Building is required" });
    }
    if (values.residentMode !== "MOVE_OUT" && !values.residentUnitId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["residentUnitId"], message: "Unit is required" });
    }
});

type FormValues = z.infer<typeof formSchema>;
const NO_PRIMARY_ORG_ACCESS = "__none__";
const BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE = {
    BUILDING_ADMIN: "building_admin",
    MANAGER: "building_manager",
    STAFF: "building_staff",
} as const;

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

const initialAssignments = (defaultRole: Role, defaultBuildingId?: string, required?: boolean) => {
    if (!required || !defaultBuildingId) return [];
    if (defaultRole === "admin") return [{ buildingId: defaultBuildingId, type: "BUILDING_ADMIN" as const }];
    if (defaultRole === "manager") return [{ buildingId: defaultBuildingId, type: "MANAGER" as const }];
    if (defaultRole === "employee") return [{ buildingId: defaultBuildingId, type: "STAFF" as const }];
    return [];
};

export function CreateUserSheet({
    open,
    onOpenChange,
    defaultRole = "admin",
    hideAdminRole = false,
    buildingOptions = [],
    defaultBuildingId,
    requireBuildingAssignment = false,
}: CreateUserSheetProps) {
    const provisionUser = useProvisionUser();
    const { data: roles } = useRoleTemplates({ enabled: open });
    const [result, setResult] = useState<ProvisionUserResponse | null>(null);

    const defaultAssignments = useMemo(
        () => initialAssignments(defaultRole, defaultBuildingId ?? buildingOptions[0]?.id, requireBuildingAssignment),
        [buildingOptions, defaultBuildingId, defaultRole, requireBuildingAssignment]
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            fullName: "",
            email: "",
            password: "",
            sendInvite: true,
            orgAccessRoleId: NO_PRIMARY_ORG_ACCESS,
            buildingAssignments: defaultAssignments,
            residentEnabled: defaultRole === "tenant",
            residentBuildingId: defaultRole === "tenant" ? (defaultBuildingId ?? buildingOptions[0]?.id ?? "") : "",
            residentUnitId: "",
            residentMode: "ADD",
        },
    });

    const assignments = useFieldArray({ control: form.control, name: "buildingAssignments" });
    const residentEnabled = useWatch({ control: form.control, name: "residentEnabled" }) ?? false;
    const residentBuildingId = useWatch({ control: form.control, name: "residentBuildingId" }) ?? "";
    const residentMode = useWatch({ control: form.control, name: "residentMode" }) ?? "ADD";
    const password = useWatch({ control: form.control, name: "password" }) ?? "";
    const sendInvite = useWatch({ control: form.control, name: "sendInvite" }) ?? true;
    const hasPassword = Boolean(password.trim());

    const { data: residentUnits, isLoading: isResidentUnitsLoading } = useBuildingUnits(residentBuildingId || "", {
        available: true,
        enabled: open && residentEnabled && Boolean(residentBuildingId) && residentMode !== "MOVE_OUT",
    });

    useEffect(() => {
        if (!open) return;
        setResult(null);
        form.reset({
            fullName: "",
            email: "",
            password: "",
            sendInvite: true,
            orgAccessRoleId: NO_PRIMARY_ORG_ACCESS,
            buildingAssignments: defaultAssignments,
            residentEnabled: defaultRole === "tenant",
            residentBuildingId: defaultRole === "tenant" ? (defaultBuildingId ?? buildingOptions[0]?.id ?? "") : "",
            residentUnitId: "",
            residentMode: "ADD",
        });
    }, [buildingOptions, defaultAssignments, defaultBuildingId, defaultRole, form, open]);

    useEffect(() => {
        if (!residentEnabled || residentMode === "MOVE_OUT") {
            form.setValue("residentUnitId", "");
            return;
        }
        const current = form.getValues("residentUnitId");
        if (!(residentUnits ?? []).some((unit) => unit.id === current)) {
            form.setValue("residentUnitId", residentUnits?.[0]?.id ?? "");
        }
    }, [form, residentEnabled, residentMode, residentUnits]);

    useEffect(() => {
        if (!hasPassword && !sendInvite) {
            form.setValue("sendInvite", true);
        }
    }, [form, hasPassword, sendInvite]);

    const orgAccessOptions = useMemo(
        () =>
            (roles ?? [])
                .map((roleEntry) => ({
                    id: String(roleEntry.id ?? roleEntry.key ?? ""),
                    name: roleEntry.name ?? roleEntry.key ?? "Role",
                }))
                .filter((roleEntry) => {
                    if (!roleEntry.id) return false;
                    const source = (roles ?? []).find((entry) => String(entry.id ?? entry.key ?? "") === roleEntry.id);
                    if (source?.scopeType && source.scopeType !== "ORG") return false;
                    if (!isPrimaryOrgAccessRoleDefinition(source ?? null)) return false;
                    if (hideAdminRole && ["admin", "org_admin"].includes(toCanonicalRole(source?.key ?? source?.name) ?? "")) return false;
                    return true;
                }),
        [hideAdminRole, roles]
    );

    const normalizedUser = result
        ? normalizeUserFromApi({
            ...result.user,
            orgAccess: result.user?.orgAccess ?? result.applied?.orgAccess,
            buildingAccess: result.user?.buildingAccess ?? result.applied?.buildingAccess,
            resident: result.user?.resident ?? result.applied?.resident,
        })
        : null;
    const access = getUserAccessView(normalizedUser);

    const submit = async (values: FormValues) => {
        const dedupedAssignments = Array.from(
            new Map(values.buildingAssignments.map((entry) => [`${entry.buildingId}:${entry.type}`, entry])).values()
        );
        const accessAssignments: NonNullable<ProvisionUserPayload["accessAssignments"]> = [];
        if (values.orgAccessRoleId?.trim() && values.orgAccessRoleId !== NO_PRIMARY_ORG_ACCESS) {
            accessAssignments.push({
                roleTemplateId: values.orgAccessRoleId.trim(),
                scopeType: "ORG",
                scopeId: null,
            });
        }
        if (dedupedAssignments.length > 0) {
            accessAssignments.push(
                ...dedupedAssignments.map((assignment) => ({
                    roleTemplateKey: BUILDING_ACCESS_ROLE_TEMPLATE_KEY_BY_TYPE[assignment.type],
                    scopeType: "BUILDING" as const,
                    scopeId: assignment.buildingId,
                }))
            );
        }
        const resident = values.residentEnabled
            ? {
                buildingId: values.residentBuildingId ?? "",
                unitId: values.residentMode === "MOVE_OUT" ? undefined : values.residentUnitId,
                mode: values.residentMode,
            }
            : undefined;

        try {
            const payload: ProvisionUserPayload = {
                identity: {
                    email: values.email.trim(),
                    name: values.fullName.trim(),
                    password: values.password?.trim() || undefined,
                    sendInvite: values.password?.trim() ? values.sendInvite : true,
                },
                ...(accessAssignments.length > 0 ? { accessAssignments } : {}),
                ...(resident ? { resident } : {}),
            };
            const response = await provisionUser.mutateAsync(payload);
            setResult(response);
            toast.success(response.linkedExisting ? "User linked and provisioned" : "User provisioned");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to provision user");
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Provision User"
            description="Create identity, Org Access, Building Access, and Resident Access in one request."
            width="w-full sm:w-[760px] lg:w-[900px]"
        >
            <div className="px-2 sm:px-4">
                {result ? (
                    <div className="space-y-6 p-1">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-emerald-900">
                                        {result.linkedExisting ? "Existing user linked" : "User provisioned"}
                                    </h3>
                                    <p className="mt-1 text-sm text-emerald-700">
                                        {[normalizedUser?.name ?? result.user?.name ?? "User", normalizedUser?.email ?? result.user?.email ?? ""]
                                            .filter(Boolean)
                                            .join(" / ")}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="secondary" className="bg-white text-emerald-700">{result.created ? "Created" : "Updated"}</Badge>
                                    {result.linkedExisting ? <Badge variant="secondary" className="bg-white text-emerald-700">Linked existing</Badge> : null}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Org Access</p>
                                <p className="mt-2 text-sm font-medium text-zinc-900">{access.primaryOrgAccess?.roleName ?? "None"}</p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Access summary</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {access.displayBadges.length > 0 ? access.displayBadges.map((badge) => (
                                        <Badge key={`${badge.key ?? badge.label}-${badge.label}`} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                            {badge.label}
                                        </Badge>
                                    )) : <span className="text-sm text-zinc-500">No secondary access</span>}
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Building Access</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {access.buildingAccess.length > 0
                                        ? access.buildingAccess.map((assignment, index) => (
                                            <Badge key={`${assignment.assignmentId ?? assignment.scopeId ?? index}`} variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                {[assignment.roleTemplateKey, assignment.buildingName ?? assignment.scopeId].filter(Boolean).join(" / ")}
                                            </Badge>
                                        ))
                                        : <span className="text-sm text-zinc-500">None</span>}
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Resident Access</p>
                                <p className="mt-2 text-sm text-zinc-900">
                                    {access.resident
                                        ? [access.resident.buildingId, access.resident.unitId, access.resident.mode].filter(Boolean).join(" / ")
                                        : "None"}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" type="button" onClick={() => setResult(null)}>Provision another</Button>
                            <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
                        </div>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submit as any)} className="space-y-6 p-1">
                            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Identity</div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField control={form.control} name="fullName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl><div className="relative"><UserRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" /><Input {...field} className="pl-9" placeholder="Jordan Lee" /></div></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl><div className="relative"><Mail className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" /><Input {...field} className="pl-9" type="email" placeholder="user@example.com" /></div></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="password" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl><div className="relative"><Lock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" /><Input {...field} className="pl-9" type="password" placeholder="Leave blank to invite" /></div></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="sendInvite" render={({ field }) => (
                                        <FormItem className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex items-start gap-3">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={hasPassword ? field.value : true}
                                                        disabled={!hasPassword}
                                                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                                                    />
                                                </FormControl>
                                                <div>
                                                    <FormLabel>Send invite</FormLabel>
                                                    <p className="text-sm text-zinc-500">
                                                        {hasPassword
                                                            ? "Optional when a password is set. Enable this to also email onboarding instructions."
                                                            : "Required when no password is set. The user must receive an invite email to access the account."}
                                                    </p>
                                                </div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Org Access</div>
                                <FormField control={form.control} name="orgAccessRoleId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Org Access</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <KeyRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <Select onValueChange={field.onChange} value={field.value || NO_PRIMARY_ORG_ACCESS}>
                                                    <SelectTrigger className="pl-9"><SelectValue placeholder="No primary org access" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={NO_PRIMARY_ORG_ACCESS}>None</SelectItem>
                                                        {orgAccessOptions.map((roleEntry) => <SelectItem key={roleEntry.id} value={roleEntry.id}>{roleEntry.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </FormControl>
                                        <p className="text-xs text-zinc-500">Role templates define Org Access. User edits should write access assignments through `/users/:userId/access-assignments`.</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Building Access</div>
                                        <p className="mt-1 text-sm text-zinc-500">Manage building-scoped access separately from Org Access.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => assignments.append({
                                            buildingId: defaultBuildingId ?? buildingOptions[0]?.id ?? "",
                                            type: defaultRole === "employee" ? "STAFF" : "MANAGER",
                                        })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add assignment
                                    </Button>
                                </div>
                                {assignments.fields.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No building assignments.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {assignments.fields.map((entry, index) => (
                                            <div key={entry.id} className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_220px_auto]">
                                                <FormField control={form.control} name={`buildingAssignments.${index}.buildingId`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Building</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Building2 className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <SelectTrigger className="pl-9"><SelectValue placeholder="Select building" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {buildingOptions.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name={`buildingAssignments.${index}.type`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Assignment type</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="BUILDING_ADMIN">Building admin</SelectItem>
                                                                <SelectItem value="MANAGER">Manager</SelectItem>
                                                                <SelectItem value="STAFF">Staff</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <div className="flex items-end">
                                                    <Button type="button" variant="ghost" className="text-zinc-500" onClick={() => assignments.remove(index)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Resident Access</div>
                                        <p className="mt-1 text-sm text-zinc-500">Use this only for resident and occupancy linkage.</p>
                                    </div>
                                    <FormField control={form.control} name="residentEnabled" render={({ field }) => (
                                        <FormItem className="flex items-center gap-2">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} /></FormControl>
                                            <FormLabel>Enable linkage</FormLabel>
                                        </FormItem>
                                    )} />
                                </div>
                                {residentEnabled ? (
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <FormField control={form.control} name="residentBuildingId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Building</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Building2 className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <SelectTrigger className="pl-9"><SelectValue placeholder="Select building" /></SelectTrigger>
                                                            <SelectContent>
                                                                {buildingOptions.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="residentUnitId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Unit</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Home className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={residentMode === "MOVE_OUT" || isResidentUnitsLoading}>
                                                            <SelectTrigger className="pl-9"><SelectValue placeholder={residentMode === "MOVE_OUT" ? "Not required" : "Select unit"} /></SelectTrigger>
                                                            <SelectContent>
                                                                {(residentUnits ?? []).map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="residentMode" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mode</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ADD">Add</SelectItem>
                                                        <SelectItem value="MOVE">Move</SelectItem>
                                                        <SelectItem value="MOVE_OUT">Move out</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No resident linkage.</div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button type="submit" disabled={provisionUser.isPending}>
                                    {provisionUser.isPending ? "Provisioning..." : "Provision user"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </div>
        </SlideOver>
    );
}
