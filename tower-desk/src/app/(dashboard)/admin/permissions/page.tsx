"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCheck, KeyRound, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCreateRole, useDeleteRole, usePermissions, useRoleTemplates, useSetRolePermissions, useUpdateRoleTemplate } from "@/lib/queries";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import { normalizeRoleKey } from "@/lib/roles";

const EMPTY_PERMISSIONS: string[] = [];
const FALLBACK_CATALOG = [
    { key: "roles.read", label: "Roles: Read" },
    { key: "roles.write", label: "Roles: Write" },
    { key: "users.read", label: "Users: Read" },
    { key: "users.write", label: "Users: Write" },
    { key: "buildings.read", label: "Buildings: Read" },
    { key: "buildings.write", label: "Buildings: Write" },
    { key: "units.read", label: "Units: Read" },
    { key: "units.write", label: "Units: Write" },
    { key: "unitTypes.read", label: "Unit Types: Read" },
    { key: "unitTypes.write", label: "Unit Types: Write" },
    { key: "owners.read", label: "Owners: Read" },
    { key: "owners.write", label: "Owners: Write" },
    { key: "owner_registry.resolve", label: "Owner Registry: Resolve" },
    { key: "owner_access_grants.read", label: "Owner Access Grants: Read" },
    { key: "owner_access_grants.write", label: "Owner Access Grants: Write" },
    { key: "serviceProviders.read", label: "Service Providers: Read" },
    { key: "serviceProviders.write", label: "Service Providers: Write" },
    { key: "residents.read", label: "Residents: Read" },
    { key: "residents.write", label: "Residents: Write" },
    { key: "occupancy.read", label: "Occupancy: Read" },
    { key: "occupancy.write", label: "Occupancy: Write" },
    { key: "requests.read", label: "Requests: Read" },
    { key: "requests.write", label: "Requests: Write" },
    { key: "requests.assign", label: "Requests: Assign" },
    { key: "requests.update_status", label: "Requests: Update Status" },
    { key: "requests.comment", label: "Requests: Comment" },
    { key: "building.assignments.read", label: "Assignments: Read" },
    { key: "building.assignments.write", label: "Assignments: Write" },
    { key: "org.profile.write", label: "Org Profile: Write" },
    { key: "platform.org.read", label: "Platform Orgs: Read" },
    { key: "platform.org.create", label: "Platform Orgs: Create" },
    { key: "platform.org.admin.read", label: "Platform Org Admins: Read" },
    { key: "platform.org.admin.create", label: "Platform Org Admins: Create" },
    { key: "parkingSlots.read", label: "Parking Slots: Read" },
    { key: "parkingSlots.create", label: "Parking Slots: Create" },
    { key: "parkingSlots.update", label: "Parking Slots: Update" },
    { key: "parkingAllocations.read", label: "Allocations: Read" },
    { key: "parkingAllocations.create", label: "Allocations: Create" },
    { key: "parkingAllocations.end", label: "Allocations: End" },
    { key: "vehicles.read", label: "Vehicles: Read" },
    { key: "vehicles.create", label: "Vehicles: Create" },
    { key: "vehicles.update", label: "Vehicles: Update" },
    { key: "vehicles.delete", label: "Vehicles: Delete" },
];

function sortKeys(keys: string[]) {
    return [...keys].sort((a, b) => a.localeCompare(b));
}

function buildPermissionSignature(keys: string[]) {
    return sortKeys(keys).join("|");
}

function formatGroupLabel(groupKey: string) {
    return groupKey
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

export default function AdminPermissionsPage() {
    const { user, baseRole } = useAuth();
    const canManageRoles = baseRole === "superadmin" || hasRbacPermission(user, "roles.write");

    const { data: roles, isLoading: isRolesLoading } = useRoleTemplates({ enabled: canManageRoles });
    const { data: permissions } = usePermissions({ enabled: canManageRoles });
    const createRole = useCreateRole();
    const deleteRole = useDeleteRole();
    const setRolePermissions = useSetRolePermissions();
    const updateRoleTemplate = useUpdateRoleTemplate();

    const [roleSelection, setRoleSelection] = useState("");
    const [rolePermissionSelection, setRolePermissionSelection] = useState<string[]>([]);
    const [roleCustomPermission, setRoleCustomPermission] = useState("");
    const [newRoleKey, setNewRoleKey] = useState("");
    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleDescription, setNewRoleDescription] = useState("");
    const [customPermissions, setCustomPermissions] = useState<string[]>([]);
    const [permissionSearch, setPermissionSearch] = useState("");

    const permissionCatalog = useMemo(() => {
        const backendPermissions = permissions && permissions.length > 0
            ? permissions.map((permission) => ({
                key: permission.key,
                label: permission.name ?? permission.key,
            }))
            : [];

        if (backendPermissions.length === 0) {
            return FALLBACK_CATALOG;
        }

        const backendKeys = new Set(backendPermissions.map((permission) => permission.key));
        const missingFromBackend = FALLBACK_CATALOG.filter((permission) => !backendKeys.has(permission.key));

        return [...backendPermissions, ...missingFromBackend];
    }, [permissions]);

    const permissionOptions = useMemo(() => {
        const catalogKeys = new Set(permissionCatalog.map((item) => item.key));
        const extras = customPermissions
            .filter((key) => !catalogKeys.has(key))
            .map((key) => ({ key, label: key }));
        return [...permissionCatalog, ...extras];
    }, [customPermissions, permissionCatalog]);

    const allowedPermissionKeys = useMemo(() => {
        const list = permissions ?? [];
        return new Set(list.map((permission) => permission.key));
    }, [permissions]);
    const canAddCustomPermissions = allowedPermissionKeys.size === 0;

    const roleOptions = useMemo(
        () => (roles ?? []).filter((role) => !role.scopeType || role.scopeType === "ORG"),
        [roles]
    );
    const selectedRole = useMemo(
        () => roleOptions.find((role) => role.id === roleSelection || role.key === roleSelection),
        [roleOptions, roleSelection]
    );
    const currentRolePermissions = selectedRole?.permissionKeys ?? EMPTY_PERMISSIONS;
    const rolePermissionSignature = buildPermissionSignature(currentRolePermissions);
    const savedRoleName = selectedRole?.name.trim() ?? "";
    const savedRoleDescription = selectedRole?.description?.trim() ?? "";
    const draftRoleName = newRoleName.trim();
    const draftRoleDescription = newRoleDescription.trim();
    const canEditSelectedRoleMetadata = Boolean(selectedRole && !selectedRole.isSystem);
    const canDeleteSelectedRole = useMemo(() => {
        if (!selectedRole) return false;
        if (selectedRole.isSystem) return false;
        const normalizedKey = normalizeRoleKey(selectedRole.key || selectedRole.name);
        return Boolean(normalizedKey);
    }, [selectedRole]);
    const isNewTemplateMode = !selectedRole;
    const selectionSignature = useMemo(
        () => buildPermissionSignature(rolePermissionSelection),
        [rolePermissionSelection]
    );
    const hasPermissionChanges = selectionSignature !== rolePermissionSignature;
    const hasMetadataChanges = Boolean(
        canEditSelectedRoleMetadata
        && (draftRoleName !== savedRoleName || draftRoleDescription !== savedRoleDescription)
    );
    const selectedPermissionGroupCount = useMemo(() => {
        return new Set(
            rolePermissionSelection.map((permissionKey) => permissionKey.split(".")[0] || "other")
        ).size;
    }, [rolePermissionSelection]);
    const isBusy =
        createRole.isPending
        || updateRoleTemplate.isPending
        || setRolePermissions.isPending
        || deleteRole.isPending;

    const toggleRolePermission = (permissionKey: string) => {
        setRolePermissionSelection((prev) =>
            prev.includes(permissionKey) ? prev.filter((key) => key !== permissionKey) : [...prev, permissionKey]
        );
    };

    const handleRoleSelectionChange = (value: string) => {
        const nextRole = roleOptions.find((role) => role.id === value || role.key === value);
        setRoleSelection(value);
        setRolePermissionSelection(nextRole?.permissionKeys ?? []);
        setNewRoleKey(nextRole?.key ?? "");
        setNewRoleName(nextRole?.name ?? "");
        setNewRoleDescription(nextRole?.description ?? "");
        setRoleCustomPermission("");
    };

    const updatePermissionSelection = (keys: string[], mode: "add" | "remove") => {
        if (keys.length === 0) return;
        setRolePermissionSelection((prev) => {
            const next = new Set(prev);
            keys.forEach((key) => {
                if (mode === "add") {
                    next.add(key);
                } else {
                    next.delete(key);
                }
            });
            return Array.from(next);
        });
    };

    const addRoleCustomPermission = () => {
        const trimmed = roleCustomPermission.trim();
        if (!trimmed) return;
        if (!canAddCustomPermissions) {
            toast.error("Custom permission keys are disabled when the server provides a permission catalog.");
            return;
        }
        setCustomPermissions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setRolePermissionSelection((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setRoleCustomPermission("");
    };

    const normalizePermissionKeys = (keys: string[]) => {
        const trimmed = keys.map((key) => key.trim()).filter(Boolean);
        const unique = Array.from(new Set(trimmed));
        if (allowedPermissionKeys.size === 0) {
            return unique;
        }
        const filtered = unique.filter((key) => allowedPermissionKeys.has(key));
        if (filtered.length !== unique.length) {
            toast.error("Some permission keys are not recognized and were ignored.");
        }
        return filtered;
    };

    const groupedPermissions = useMemo(() => {
        const search = permissionSearch.trim().toLowerCase();
        const filtered = permissionOptions.filter((permission) => {
            if (!search) return true;
            const haystack = `${permission.key} ${permission.label}`.toLowerCase();
            return haystack.includes(search);
        });

        const groups = new Map<string, { label: string; items: typeof filtered }>();
        filtered.forEach((permission) => {
            const [groupKeyRaw] = permission.key.split(".");
            const groupKey = groupKeyRaw || "other";
            const entry = groups.get(groupKey) ?? { label: formatGroupLabel(groupKey), items: [] };
            entry.items.push(permission);
            groups.set(groupKey, entry);
        });

        return Array.from(groups.entries())
            .map(([key, value]) => ({
                key,
                label: value.label,
                items: sortKeys(value.items.map((item) => item.key))
                    .map((permissionKey) => value.items.find((item) => item.key === permissionKey))
                    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [permissionOptions, permissionSearch]);

    const visiblePermissionKeys = useMemo(
        () => groupedPermissions.flatMap((group) => group.items.map((item) => item.key)),
        [groupedPermissions]
    );
    const visibleSelectedCount = useMemo(
        () => visiblePermissionKeys.filter((key) => rolePermissionSelection.includes(key)).length,
        [rolePermissionSelection, visiblePermissionKeys]
    );
    const permissionCatalogSource = permissions && permissions.length > 0 ? "Backend permission catalog" : "Fallback catalog";
    const activeTemplateLabel = selectedRole?.name ?? "New template draft";
    const activeTemplateKey = selectedRole?.key ?? (newRoleKey.trim() || "Unsaved");
    const unsavedChangeCount = Number(hasMetadataChanges) + Number(hasPermissionChanges);

    const resetDraft = () => {
        setRoleSelection("");
        setRolePermissionSelection([]);
        setRoleCustomPermission("");
        setNewRoleKey("");
        setNewRoleName("");
        setNewRoleDescription("");
        setPermissionSearch("");
        setCustomPermissions([]);
    };

    const submitCreateOrUpdateRole = async () => {
        if (selectedRole) {
            if (!hasMetadataChanges && !hasPermissionChanges) {
                toast.error("No changes to save.");
                return;
            }

            const name = newRoleName.trim();
            if (!name) {
                toast.error("Template name is required.");
                return;
            }

            const roleId = selectedRole.id || selectedRole.key;

            let metadataSaved = false;
            try {
                if (hasMetadataChanges) {
                    await updateRoleTemplate.mutateAsync({
                        roleId,
                        name,
                        description: newRoleDescription.trim() || null,
                    });
                    metadataSaved = true;
                }

                if (hasPermissionChanges) {
                    const normalized = normalizePermissionKeys(rolePermissionSelection);
                    await setRolePermissions.mutateAsync({ roleId, permissionKeys: normalized, mode: "replace" });
                }

                if (hasMetadataChanges && hasPermissionChanges) {
                    toast.success("Template updated.");
                } else if (hasMetadataChanges) {
                    toast.success("Template details updated.");
                } else {
                    toast.success("Template permissions updated.");
                }
            } catch (error) {
                if (metadataSaved) {
                    toast.error("Template details were saved, but permission updates failed.");
                    return;
                }
                toast.error(error instanceof Error ? error.message : "Failed to update template.");
            }
            return;
        }

        const key = newRoleKey.trim().toLowerCase();
        const name = newRoleName.trim();
        if (!key || !name) {
            toast.error("Template key and name are required.");
            return;
        }

        const normalized = normalizePermissionKeys(rolePermissionSelection);
        if (normalized.length === 0) {
            toast.error("Select at least one permission.");
            return;
        }

        createRole.mutate(
            { key, name, description: newRoleDescription.trim() || undefined },
            {
                onSuccess: (role) => {
                    const roleId = role.id || role.key;
                    setRolePermissions.mutate(
                        { roleId, permissionKeys: normalized, mode: "replace" },
                        {
                            onSuccess: () => {
                                toast.success("Template created successfully.");
                                setRoleSelection(roleId);
                            },
                            onError: (error) =>
                                toast.error(error instanceof Error ? error.message : "Failed to set template permissions."),
                        }
                    );
                },
                onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to create template."),
            }
        );
    };

    const handleDeleteRole = () => {
        if (!selectedRole) return;
        const roleId = selectedRole.id || selectedRole.key;
        deleteRole.mutate(
            { roleId },
            {
                onSuccess: () => {
                    toast.success("Template deleted successfully.");
                    resetDraft();
                },
                onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to delete template."),
            }
        );
    };

    if (!canManageRoles) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Permissions</h1>
                        <p className="text-sm text-zinc-500">You do not have access to manage role permissions.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.1),_transparent_68%)] lg:block" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-700 backdrop-blur">
                                Access Governance
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[2rem]">
                                Roles &amp; Rights
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                                Maintain organization-level role templates, compare permission coverage, and save rights changes with a clearer review flow.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
                            <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                        <KeyRound className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                            Template Scope
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-zinc-950">Organization-wide roles</div>
                                        <div className="mt-1 text-xs text-zinc-500">
                                            Templates define org access and bundle permission sets used across the portal.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{roleOptions.length}</div>
                    <p className="mt-1 text-sm text-zinc-500">Org access templates</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <KeyRound className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{permissionOptions.length}</div>
                    <p className="mt-1 text-sm text-zinc-500">Available permission keys</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <CheckCheck className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{rolePermissionSelection.length}</div>
                    <p className="mt-1 text-sm text-zinc-500">Draft permissions selected</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                        <Search className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{selectedPermissionGroupCount}</div>
                    <p className="mt-1 text-sm text-zinc-500">Permission groups covered</p>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">Template Workspace</h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                Choose a role template, review its saved baseline, then edit metadata and permission coverage without restructuring the underlying flow.
                            </p>
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                type="search"
                                value={permissionSearch}
                                onChange={(event) => setPermissionSearch(event.target.value)}
                                placeholder="Search permissions"
                                className="h-11 rounded-xl border-zinc-200 bg-white pl-9"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        <FilterField label="Template Scope">
                            <div className="text-sm text-zinc-700">Organization-level templates only. Building-scoped assignments are managed separately.</div>
                        </FilterField>
                        <FilterField label="Catalog Source">
                            <div className="text-sm text-zinc-700">{permissionCatalogSource}</div>
                        </FilterField>
                        <FilterField label="Current Mode">
                            <div className="text-sm text-zinc-700">{isNewTemplateMode ? "Creating new template" : `Editing ${selectedRole?.name}`}</div>
                        </FilterField>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Template
                            <span className="font-medium text-zinc-900">{activeTemplateLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Key
                            <span className="font-medium text-zinc-900">{activeTemplateKey}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Visible matches
                            <span className="font-medium text-zinc-900">{visiblePermissionKeys.length}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Visible selected
                            <span className="font-medium text-zinc-900">{visibleSelectedCount}</span>
                        </span>
                        {permissionSearch.trim() ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                                Search
                                <span className="font-medium text-zinc-900">{permissionSearch.trim()}</span>
                            </span>
                        ) : null}
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ${
                            unsavedChangeCount > 0
                                ? "border border-amber-200 bg-amber-50 text-amber-800"
                                : "border border-zinc-900 bg-zinc-950 text-white"
                        }`}>
                            {unsavedChangeCount > 0 ? "Unsaved changes" : "Ready"}
                            <span>{unsavedChangeCount > 0 ? unsavedChangeCount : "0 pending"}</span>
                        </span>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
                <div className="space-y-6">
                    <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Template Workspace</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                    <Select value={roleSelection} onValueChange={handleRoleSelectionChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isRolesLoading ? "Loading templates..." : "Select a template"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map((role) => (
                                                <SelectItem key={role.id || role.key} value={role.id || role.key}>
                                                    {role.name} ({role.key})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant={isNewTemplateMode ? "default" : "outline"} onClick={resetDraft}>
                                        New template
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                    {isNewTemplateMode ? "Creating" : "Editing"}
                                </Badge>
                                {hasMetadataChanges ? (
                                    <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700">
                                        Unsaved detail changes
                                    </Badge>
                                ) : null}
                                {hasPermissionChanges ? (
                                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                        Unsaved permission changes
                                    </Badge>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                            {selectedRole ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold text-zinc-900">{selectedRole.name}</p>
                                            <p className="mt-1 text-sm text-zinc-500">{selectedRole.description || "No description provided."}</p>
                                        </div>
                                        <Badge variant="outline" className="border-zinc-300 bg-white text-zinc-700">
                                            {selectedRole.key}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="bg-white text-zinc-700">
                                            {currentRolePermissions.length} saved permissions
                                        </Badge>
                                        <Badge variant="secondary" className="bg-white text-zinc-700">
                                            {selectedPermissionGroupCount} groups selected
                                        </Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-zinc-900">Start with a blank template</p>
                                    <p className="text-sm text-zinc-500">
                                        Add the template details on the right, then choose the permissions it should include.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Permissions</p>
                                <h2 className="mt-2 text-lg font-semibold text-zinc-900">Permission Matrix</h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Search, bulk-select visible permissions, and review changes before saving.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                    {visibleSelectedCount}/{visiblePermissionKeys.length} visible selected
                                </Badge>
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                    {rolePermissionSelection.length} total selected
                                </Badge>
                            </div>
                        </div>

                            <div className="mt-5 space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                        variant="outline"
                                        onClick={() => updatePermissionSelection(visiblePermissionKeys, "add")}
                                        disabled={visiblePermissionKeys.length === 0}
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                        Select visible
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => updatePermissionSelection(visiblePermissionKeys, "remove")}
                                        disabled={visibleSelectedCount === 0}
                                    >
                                        Clear visible
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setRolePermissionSelection(currentRolePermissions)}
                                        disabled={!selectedRole || !hasPermissionChanges}
                                    >
                                        Reset to saved
                                    </Button>
                                </div>
                            </div>

                            {groupedPermissions.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-10 text-center text-sm text-zinc-500">
                                    No permissions match this search.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {groupedPermissions.map((group) => {
                                        const groupKeys = group.items.map((item) => item.key);
                                        const selectedCount = groupKeys.filter((key) => rolePermissionSelection.includes(key)).length;
                                        const allSelected = selectedCount === groupKeys.length;
                                        const someSelected = selectedCount > 0 && selectedCount < groupKeys.length;

                                        const handleGroupCheckboxChange = () => {
                                            if (allSelected) {
                                                updatePermissionSelection(groupKeys, "remove");
                                            } else {
                                                updatePermissionSelection(groupKeys, "add");
                                            }
                                        };

                                        return (
                                            <div key={group.key} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <label className="flex cursor-pointer items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={allSelected}
                                                            ref={(element) => {
                                                                if (element) {
                                                                    element.indeterminate = someSelected;
                                                                }
                                                            }}
                                                            onChange={handleGroupCheckboxChange}
                                                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                                        />
                                                        <div>
                                                            <p className="text-sm font-semibold capitalize text-zinc-900">{group.label}</p>
                                                            <p className="text-xs text-zinc-500">
                                                                {selectedCount} of {groupKeys.length} selected
                                                            </p>
                                                        </div>
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => updatePermissionSelection(groupKeys, "add")}
                                                            disabled={allSelected}
                                                        >
                                                            Select all
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => updatePermissionSelection(groupKeys, "remove")}
                                                            disabled={selectedCount === 0}
                                                        >
                                                            Clear
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                                                    {group.items.map((permission) => {
                                                        const checked = rolePermissionSelection.includes(permission.key);
                                                        return (
                                                            <label
                                                                key={permission.key}
                                                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                                                                    checked
                                                                        ? "border-zinc-900 bg-white shadow-sm"
                                                                        : "border-zinc-200 bg-white/80 hover:border-zinc-300"
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleRolePermission(permission.key)}
                                                                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-zinc-900">{permission.label}</p>
                                                                    <p className="mt-1 break-all text-xs text-zinc-500">{permission.key}</p>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                    <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Template Details</p>
                                <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                                    {selectedRole ? "Review and Save" : "Create New Template"}
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {selectedRole
                                        ? selectedRole.isSystem
                                            ? "System templates are read-only here."
                                            : "Existing templates can update name, description, and permissions here. Template keys stay fixed."
                                        : "Add the template identity first, then save the selected permissions."}
                                </p>
                            </div>
                            {selectedRole ? (
                                <Badge variant="outline" className="border-zinc-300 bg-zinc-50 text-zinc-700">
                                    Existing
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-zinc-300 bg-zinc-50 text-zinc-700">
                                    New
                                </Badge>
                            )}
                        </div>

                        <div className="mt-5 space-y-4">
                            <div>
                                <label className="mb-1 block text-xs text-zinc-500">Template Key</label>
                                <Input
                                    type="text"
                                    value={newRoleKey}
                                    onChange={(event) => setNewRoleKey(event.target.value)}
                                    placeholder="Template key (e.g. custom_viewer)"
                                    disabled={Boolean(selectedRole)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-zinc-500">Template Name</label>
                                <Input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(event) => setNewRoleName(event.target.value)}
                                    placeholder="Template name"
                                    disabled={Boolean(selectedRole?.isSystem)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-zinc-500">Description</label>
                                <Input
                                    type="text"
                                    value={newRoleDescription}
                                    onChange={(event) => setNewRoleDescription(event.target.value)}
                                    placeholder="Description (optional)"
                                    disabled={Boolean(selectedRole?.isSystem)}
                                />
                            </div>
                        </div>

                        {selectedRole ? (
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-600">
                                {selectedRole.isSystem
                                    ? "System templates are read-only and cannot be changed here."
                                    : "Template keys stay fixed after creation. You can update the name, description, and permissions for existing templates."}
                            </div>
                        ) : null}

                        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Selection Summary</p>
                            <div className="mt-3 space-y-2 text-sm text-zinc-600">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Permissions selected</span>
                                    <span className="font-semibold text-zinc-900">{rolePermissionSelection.length}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Groups covered</span>
                                    <span className="font-semibold text-zinc-900">{selectedPermissionGroupCount}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Visible matches</span>
                                    <span className="font-semibold text-zinc-900">{visiblePermissionKeys.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add Custom Key</p>
                            <p className="mt-2 text-sm text-zinc-500">
                                {canAddCustomPermissions
                                    ? "Use this only when a permission is missing from the catalog."
                                    : "Custom keys are disabled because the backend already defines the allowed catalog."}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Input
                                    type="text"
                                    value={roleCustomPermission}
                                    onChange={(event) => setRoleCustomPermission(event.target.value)}
                                    placeholder="e.g. unitTypes.write"
                                    disabled={!canAddCustomPermissions}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addRoleCustomPermission}
                                    disabled={!canAddCustomPermissions}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>

                        {selectedRole && !canDeleteSelectedRole ? (
                            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-600">
                                System org-access templates cannot be deleted.
                            </div>
                        ) : null}

                        <div className="mt-6 flex flex-col gap-2">
                            <Button
                                type="button"
                                onClick={() => {
                                    void submitCreateOrUpdateRole();
                                }}
                                disabled={isBusy || (Boolean(selectedRole) && !hasMetadataChanges && !hasPermissionChanges)}
                            >
                                {selectedRole
                                    ? updateRoleTemplate.isPending || setRolePermissions.isPending
                                        ? "Saving changes..."
                                        : "Save changes"
                                    : createRole.isPending || setRolePermissions.isPending
                                        ? "Creating template..."
                                        : "Create template"}
                            </Button>
                            <div className="flex gap-2">
                                {selectedRole ? (
                                    <Button type="button" variant="outline" onClick={resetDraft} disabled={isBusy} className="flex-1">
                                        Switch to new
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setRolePermissionSelection([])}
                                        disabled={rolePermissionSelection.length === 0 || isBusy}
                                        className="flex-1"
                                    >
                                        Clear selection
                                    </Button>
                                )}

                                {selectedRole && canDeleteSelectedRole ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleDeleteRole}
                                        disabled={deleteRole.isPending || setRolePermissions.isPending || createRole.isPending}
                                        className="flex-1 text-rose-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        {deleteRole.isPending ? "Deleting..." : "Delete template"}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
