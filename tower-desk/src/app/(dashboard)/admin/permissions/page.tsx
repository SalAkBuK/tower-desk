"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCreateRole, usePermissions, useRoles, useSetRolePermissions } from "@/lib/queries";

export default function AdminPermissionsPage() {
    const { user, role } = useAuth();
    const permissionKeys = useMemo(() => {
        const keys = [...(user?.roleKeys ?? []), ...(user?.orgRoleKeys ?? [])];
        return new Set(keys.map((key) => String(key).toLowerCase()));
    }, [user?.roleKeys, user?.orgRoleKeys]);
    const canManageRoles = role === 'superadmin' || role === 'org_admin' || permissionKeys.has('roles.write');

    const { data: roles, isLoading: isRolesLoading } = useRoles({ enabled: canManageRoles });
    const { data: permissions } = usePermissions({ enabled: canManageRoles });
    const createRole = useCreateRole();
    const setRolePermissions = useSetRolePermissions();

    const [roleSelection, setRoleSelection] = useState('');
    const [rolePermissionSelection, setRolePermissionSelection] = useState<string[]>([]);
    const [roleCustomPermission, setRoleCustomPermission] = useState('');
    const [roleMode, setRoleMode] = useState<'add' | 'replace'>('add');
    const [newRoleKey, setNewRoleKey] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDescription, setNewRoleDescription] = useState('');
    const [customPermissions, setCustomPermissions] = useState<string[]>([]);
    const [permissionSearch, setPermissionSearch] = useState('');

    const fallbackCatalog = [
        { key: 'buildings.read', label: 'Buildings: Read' },
        { key: 'buildings.write', label: 'Buildings: Write' },
        { key: 'units.read', label: 'Units: Read' },
        { key: 'units.write', label: 'Units: Write' },
        { key: 'unitTypes.read', label: 'Unit Types: Read' },
        { key: 'unitTypes.write', label: 'Unit Types: Write' },
        { key: 'owners.read', label: 'Owners: Read' },
        { key: 'owners.write', label: 'Owners: Write' },
        { key: 'requests.read', label: 'Requests: Read' },
        { key: 'requests.write', label: 'Requests: Write' },
        { key: 'users.read', label: 'Users: Read' },
        { key: 'users.write', label: 'Users: Write' },
        { key: 'residents.read', label: 'Residents: Read' },
        { key: 'residents.write', label: 'Residents: Write' },
        { key: 'building.assignments.read', label: 'Assignments: Read' },
        { key: 'building.assignments.write', label: 'Assignments: Write' },
        { key: 'roles.read', label: 'Roles: Read' },
        { key: 'roles.write', label: 'Roles: Write' },
    ];

    const permissionCatalog = useMemo(() => {
        if (permissions && permissions.length > 0) {
            return permissions.map((permission) => ({
                key: permission.key,
                label: permission.name ?? permission.key,
            }));
        }
        return fallbackCatalog;
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
    const currentRolePermissions = selectedRole?.permissionKeys ?? [];

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

    const applyRolePermissions = () => {
        const trimmedRoleId = roleSelection.trim();
        if (!trimmedRoleId) {
            toast.error("Enter a role id");
            return;
        }
        const normalized = normalizePermissionKeys(rolePermissionSelection);
        if (normalized.length === 0) {
            toast.error("Select at least one permission");
            return;
        }
        setRolePermissions.mutate(
            { roleId: trimmedRoleId, permissionKeys: normalized, mode: roleMode },
            {
                onSuccess: () => {
                    toast.success("Role permissions updated");
                    setRolePermissionSelection([]);
                },
                onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to update role permissions"),
            }
        );
    };

    const submitCreateRole = () => {
        const key = newRoleKey.trim().toLowerCase();
        const name = newRoleName.trim();
        if (!key || !name) {
            toast.error("Role key and name are required");
            return;
        }
        createRole.mutate(
            { key, name, description: newRoleDescription.trim() || undefined },
            {
                onSuccess: (role) => {
                    toast.success("Role created");
                    setRoleSelection(role.id || role.key);
                    setNewRoleKey('');
                    setNewRoleName('');
                    setNewRoleDescription('');
                },
                onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to create role"),
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
                                <input
                                    type="text"
                                    value={roleSelection}
                                    onChange={(event) => setRoleSelection(event.target.value)}
                                    placeholder="Or paste a role id"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                />
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
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mode</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(['add', 'replace'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setRoleMode(mode)}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                            roleMode === mode
                                                ? "border-zinc-900 bg-zinc-900 text-white"
                                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                                        }`}
                                    >
                                        {mode === 'add' ? 'Add' : 'Replace'}
                                    </button>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (currentRolePermissions.length === 0) {
                                            toast.error("No permissions found for this role");
                                            return;
                                        }
                                        setRolePermissionSelection(currentRolePermissions);
                                        setRoleMode('replace');
                                    }}
                                    disabled={currentRolePermissions.length === 0}
                                >
                                    Load current
                                </Button>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Permissions</p>
                            <div className="mt-3 space-y-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <input
                                        type="search"
                                        value={permissionSearch}
                                        onChange={(event) => setPermissionSearch(event.target.value)}
                                        placeholder="Search permissions..."
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:max-w-xs"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => updatePermissionSelection(visiblePermissionKeys, 'add')}
                                            disabled={visiblePermissionKeys.length === 0}
                                        >
                                            Select visible
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => updatePermissionSelection(visiblePermissionKeys, 'remove')}
                                            disabled={visiblePermissionKeys.length === 0}
                                        >
                                            Clear visible
                                        </Button>
                                    </div>
                                </div>

                                {groupedPermissions.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-sm text-zinc-500">
                                        No permissions match this search.
                                    </div>
                                ) : (
                                    groupedPermissions.map((group) => {
                                        const groupKeys = group.items.map((item) => item.key);
                                        const selectedCount = groupKeys.filter((key) => rolePermissionSelection.includes(key)).length;
                                        return (
                                            <div key={group.key} className="rounded-lg border border-zinc-200 bg-white p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold capitalize text-zinc-800">{group.label}</p>
                                                        <p className="text-xs text-zinc-500">
                                                            {selectedCount}/{groupKeys.length} selected
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => updatePermissionSelection(groupKeys, 'add')}
                                                        >
                                                            Select group
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => updatePermissionSelection(groupKeys, 'remove')}
                                                        >
                                                            Clear group
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

                        <Button type="button" onClick={applyRolePermissions} disabled={setRolePermissions.isPending}>
                            Apply role permissions
                        </Button>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Create role</p>
                            <div className="mt-2 space-y-2">
                                <input
                                    type="text"
                                    value={newRoleKey}
                                    onChange={(event) => setNewRoleKey(event.target.value)}
                                    placeholder="Role key (e.g. custom_admin)"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                />
                                <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(event) => setNewRoleName(event.target.value)}
                                    placeholder="Role name"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                />
                                <input
                                    type="text"
                                    value={newRoleDescription}
                                    onChange={(event) => setNewRoleDescription(event.target.value)}
                                    placeholder="Description (optional)"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                />
                            </div>
                        </div>
                        <Button type="button" onClick={submitCreateRole} disabled={createRole.isPending}>
                            Create role
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
