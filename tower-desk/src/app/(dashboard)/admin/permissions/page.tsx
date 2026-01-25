"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCreateRole, usePermissions, useRoles, useSetRolePermissions } from "@/lib/queries";

const EMPTY_PERMISSIONS: string[] = [];

export default function AdminPermissionsPage() {
    const { user, baseRole } = useAuth();
    const permissionKeys = useMemo(() => {
        const keys = [
            ...(user?.effectivePermissions ?? []),
            ...(user?.roleKeys ?? []),
            ...(user?.orgRoleKeys ?? []),
        ];
        return new Set(keys.map((key) => String(key).toLowerCase()));
    }, [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]);
    const canManageRoles = baseRole === 'superadmin' || baseRole === 'org_admin' || permissionKeys.has('roles.write');

    const { data: roles, isLoading: isRolesLoading } = useRoles({ enabled: canManageRoles });
    const { data: permissions } = usePermissions({ enabled: canManageRoles });
    const createRole = useCreateRole();
    const setRolePermissions = useSetRolePermissions();

    const [roleSelection, setRoleSelection] = useState('');
    const [rolePermissionSelection, setRolePermissionSelection] = useState<string[]>([]);
    const [roleCustomPermission, setRoleCustomPermission] = useState('');
    const [newRoleKey, setNewRoleKey] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDescription, setNewRoleDescription] = useState('');
    const [customPermissions, setCustomPermissions] = useState<string[]>([]);
    const [permissionSearch, setPermissionSearch] = useState('');

    const fallbackCatalog = [
        { key: 'roles.read', label: 'Roles: Read' },
        { key: 'roles.write', label: 'Roles: Write' },
        { key: 'users.read', label: 'Users: Read' },
        { key: 'users.write', label: 'Users: Write' },
        { key: 'buildings.read', label: 'Buildings: Read' },
        { key: 'buildings.write', label: 'Buildings: Write' },
        { key: 'units.read', label: 'Units: Read' },
        { key: 'units.write', label: 'Units: Write' },
        { key: 'unitTypes.read', label: 'Unit Types: Read' },
        { key: 'unitTypes.write', label: 'Unit Types: Write' },
        { key: 'owners.read', label: 'Owners: Read' },
        { key: 'owners.write', label: 'Owners: Write' },
        { key: 'residents.read', label: 'Residents: Read' },
        { key: 'residents.write', label: 'Residents: Write' },
        { key: 'occupancy.read', label: 'Occupancy: Read' },
        { key: 'occupancy.write', label: 'Occupancy: Write' },
        { key: 'requests.read', label: 'Requests: Read' },
        { key: 'requests.write', label: 'Requests: Write' },
        { key: 'requests.assign', label: 'Requests: Assign' },
        { key: 'requests.update_status', label: 'Requests: Update Status' },
        { key: 'requests.comment', label: 'Requests: Comment' },
        { key: 'building.assignments.read', label: 'Assignments: Read' },
        { key: 'building.assignments.write', label: 'Assignments: Write' },
        { key: 'org.profile.write', label: 'Org Profile: Write' },
        { key: 'platform.org.read', label: 'Platform Orgs: Read' },
        { key: 'platform.org.create', label: 'Platform Orgs: Create' },
        { key: 'platform.org.admin.read', label: 'Platform Org Admins: Read' },
        { key: 'platform.org.admin.create', label: 'Platform Org Admins: Create' },
        // Parking Slots
        { key: 'parkingSlots.read', label: 'Parking Slots: Read' },
        { key: 'parkingSlots.create', label: 'Parking Slots: Create' },
        { key: 'parkingSlots.update', label: 'Parking Slots: Update' },
        // Allocations
        { key: 'parkingAllocations.read', label: 'Allocations: Read' },
        { key: 'parkingAllocations.create', label: 'Allocations: Create' },
        { key: 'parkingAllocations.end', label: 'Allocations: End' },
        // Vehicles
        { key: 'vehicles.read', label: 'Vehicles: Read' },
        { key: 'vehicles.create', label: 'Vehicles: Create' },
        { key: 'vehicles.update', label: 'Vehicles: Update' },
        { key: 'vehicles.delete', label: 'Vehicles: Delete' },
    ];

    const permissionCatalog = useMemo(() => {
        const backendPermissions = permissions && permissions.length > 0
            ? permissions.map((permission) => ({
                key: permission.key,
                label: permission.name ?? permission.key,
            }))
            : [];

        if (backendPermissions.length === 0) {
            return fallbackCatalog;
        }

        const backendKeys = new Set(backendPermissions.map((p) => p.key));
        const missingFromBackend = fallbackCatalog.filter((p) => !backendKeys.has(p.key));

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

    const roleOptions = useMemo(() => roles ?? [], [roles]);
    const selectedRole = useMemo(
        () => roleOptions.find((role) => role.id === roleSelection || role.key === roleSelection),
        [roleOptions, roleSelection]
    );
    const rolePermissionSignature = useMemo(
        () => (selectedRole?.permissionKeys ?? EMPTY_PERMISSIONS).join("|"),
        [selectedRole?.permissionKeys]
    );
    const currentRolePermissions = useMemo(
        () => selectedRole?.permissionKeys ?? EMPTY_PERMISSIONS,
        [selectedRole?.id, selectedRole?.key, rolePermissionSignature]
    );

    // Auto-load permissions and role data when a role is selected
    useEffect(() => {
        if (selectedRole) {
            if (currentRolePermissions.length > 0) {
                setRolePermissionSelection(currentRolePermissions);
            } else {
                setRolePermissionSelection([]);
            }
            setNewRoleKey(selectedRole.key || '');
            setNewRoleName(selectedRole.name || '');
            setNewRoleDescription(selectedRole.description || '');
        } else {
            setRolePermissionSelection([]);
            setNewRoleKey('');
            setNewRoleName('');
            setNewRoleDescription('');
        }
    }, [
        selectedRole?.id,
        selectedRole?.key,
        selectedRole?.name,
        selectedRole?.description,
        rolePermissionSignature,
    ]);

    const toggleRolePermission = (permissionKey: string) => {
        setRolePermissionSelection((prev) =>
            prev.includes(permissionKey) ? prev.filter((key) => key !== permissionKey) : [...prev, permissionKey]
        );
    };

    const updatePermissionSelection = (keys: string[], mode: 'add' | 'remove') => {
        if (keys.length === 0) return;
        setRolePermissionSelection((prev) => {
            const next = new Set(prev);
            keys.forEach((key) => {
                if (mode === 'add') {
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
        setCustomPermissions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setRolePermissionSelection((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setRoleCustomPermission('');
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
            const [groupKeyRaw] = permission.key.split('.');
            const groupKey = groupKeyRaw || 'other';
            const label = groupKey.replace(/[-_]/g, ' ');
            const entry = groups.get(groupKey) ?? { label, items: [] };
            entry.items.push(permission);
            groups.set(groupKey, entry);
        });
        return Array.from(groups.entries())
            .map(([key, value]) => ({ key, label: value.label, items: value.items }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [permissionOptions, permissionSearch]);

    const visiblePermissionKeys = useMemo(
        () => groupedPermissions.flatMap((group) => group.items.map((item) => item.key)),
        [groupedPermissions]
    );

    const submitCreateOrUpdateRole = () => {
        const key = newRoleKey.trim().toLowerCase();
        const name = newRoleName.trim();
        if (!key || !name) {
            toast.error("Role key and name are required");
            return;
        }

        const normalized = normalizePermissionKeys(rolePermissionSelection);
        if (normalized.length === 0) {
            toast.error("Select at least one permission");
            return;
        }

        // Update existing role
        if (selectedRole) {
            const roleId = selectedRole.id || selectedRole.key;
            setRolePermissions.mutate(
                { roleId, permissionKeys: normalized, mode: 'replace' },
                {
                    onSuccess: () => {
                        toast.success("Role updated successfully");
                    },
                    onError: (error) =>
                        toast.error(error instanceof Error ? error.message : "Failed to update role"),
                }
            );
        } else {
            // Create new role
            createRole.mutate(
                { key, name, description: newRoleDescription.trim() || undefined },
                {
                    onSuccess: (role) => {
                        const roleId = role.id || role.key;
                        // After creating, set permissions
                        setRolePermissions.mutate(
                            { roleId, permissionKeys: normalized, mode: 'replace' },
                            {
                                onSuccess: () => {
                                    toast.success("Role created successfully");
                                    setRoleSelection(roleId);
                                },
                                onError: (error) =>
                                    toast.error(error instanceof Error ? error.message : "Failed to set role permissions"),
                            }
                        );
                    },
                    onError: (error) =>
                        toast.error(error instanceof Error ? error.message : "Failed to create role"),
                }
            );
        }
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Permissions</h1>
                        <p className="mt-1 text-sm text-zinc-500">Define role-level access for your organization.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs uppercase tracking-wide text-zinc-400">Role Access</span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</p>
                            <div className="mt-2 space-y-2">
                                <Select
                                    value={roleSelection}
                                    onValueChange={(value) => setRoleSelection(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isRolesLoading ? "Loading roles..." : "Select a role"} />
                                    </SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map((role) => (
                                        <SelectItem key={role.id || role.key} value={role.id || role.key}>
                                            {role.name} ({role.key})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {currentRolePermissions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {currentRolePermissions.slice(0, 8).map((permission) => (
                                        <Badge key={permission} variant="secondary" className="bg-zinc-100 text-zinc-600">
                                                {permission}
                                            </Badge>
                                        ))}
                                        {currentRolePermissions.length > 8 && (
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                                +{currentRolePermissions.length - 8} more
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Permissions</p>
                            <div className="mt-3 space-y-4">
                                <input
                                    type="search"
                                    value={permissionSearch}
                                    onChange={(event) => setPermissionSearch(event.target.value)}
                                    placeholder="Search permissions..."
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:max-w-xs"
                                />

                                {groupedPermissions.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-sm text-zinc-500">
                                        No permissions match this search.
                                    </div>
                                ) : (
                                    groupedPermissions.map((group) => {
                                        const groupKeys = group.items.map((item) => item.key);
                                        const selectedCount = groupKeys.filter((key) => rolePermissionSelection.includes(key)).length;
                                        const allSelected = selectedCount === groupKeys.length;
                                        const someSelected = selectedCount > 0 && selectedCount < groupKeys.length;

                                        const handleGroupCheckboxChange = () => {
                                            if (allSelected) {
                                                updatePermissionSelection(groupKeys, 'remove');
                                            } else {
                                                updatePermissionSelection(groupKeys, 'add');
                                            }
                                        };

                                        return (
                                            <div key={group.key} className="rounded-lg border border-zinc-200 bg-white p-3">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        ref={(el) => {
                                                            if (el) {
                                                                el.indeterminate = someSelected;
                                                            }
                                                        }}
                                                        onChange={handleGroupCheckboxChange}
                                                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold capitalize text-zinc-800">{group.label}</p>
                                                        <p className="text-xs text-zinc-500">
                                                            {selectedCount}/{groupKeys.length} selected
                                                        </p>
                                                    </div>
                                                </label>
                                                <div className="mt-3 ml-7 grid gap-2 sm:grid-cols-2">
                                                    {group.items.map((permission) => (
                                                        <label
                                                            key={permission.key}
                                                            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={rolePermissionSelection.includes(permission.key)}
                                                                onChange={() => toggleRolePermission(permission.key)}
                                                                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                                            />
                                                            <span>{permission.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add custom key</p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="text"
                                    value={roleCustomPermission}
                                    onChange={(event) => setRoleCustomPermission(event.target.value)}
                                    placeholder="e.g. unitTypes.write"
                                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                />
                                <Button type="button" variant="outline" onClick={addRoleCustomPermission}>
                                    Add
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {rolePermissionSelection.length > 0 && (
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                    {rolePermissionSelection.length} selected
                                </Badge>
                            )}
                            {rolePermissionSelection.length > 0 && (
                                <Button type="button" variant="ghost" onClick={() => setRolePermissionSelection([])}>
                                    Clear selection
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                {selectedRole ? 'Update role' : 'Create role'}
                            </p>
                            <div className="mt-2 space-y-2">
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">Role Key</label>
                                    <input
                                        type="text"
                                        value={newRoleKey}
                                        onChange={(event) => setNewRoleKey(event.target.value)}
                                        placeholder="Role key (e.g. custom_admin)"
                                        disabled={!!selectedRole}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                    />
                                    {selectedRole && (
                                        <p className="text-xs text-zinc-400 mt-1">Role key cannot be changed</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">Role Name</label>
                                    <input
                                        type="text"
                                        value={newRoleName}
                                        onChange={(event) => setNewRoleName(event.target.value)}
                                        placeholder="Role name"
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">Description</label>
                                    <input
                                        type="text"
                                        value={newRoleDescription}
                                        onChange={(event) => setNewRoleDescription(event.target.value)}
                                        placeholder="Description (optional)"
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {selectedRole && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setRoleSelection('');
                                        setNewRoleKey('');
                                        setNewRoleName('');
                                        setNewRoleDescription('');
                                        setRolePermissionSelection([]);
                                    }}
                                >
                                    New role
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={submitCreateOrUpdateRole}
                                disabled={createRole.isPending || setRolePermissions.isPending}
                                className="flex-1"
                            >
                                {selectedRole ? 'Update role' : 'Create role'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
