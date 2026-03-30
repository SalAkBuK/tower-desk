
"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useAdminUsers,
    useEffectivePermissions,
    usePermissions,
    useRoles,
    useSetUserPermissionOverrides,
    useSetUserRoles,
    useUserPermissionOverrides,
    useUserRoles,
    useManagerBuildings
} from "@/lib/queries";
import type { PermissionEffect, Role } from "@/lib/types";
import { formatRoleLabel, getCanonicalRole, isOrganizationAdminRole } from "@/lib/roles";

export default function AdminUserAccessPage() {
    const { user, baseRole } = useAuth();
    const searchParams = useSearchParams();
    const permissionKeys = useMemo(() => {
        const keys = [
            ...(user?.effectivePermissions ?? []),
            ...(user?.roleKeys ?? []),
            ...(user?.orgRoleKeys ?? []),
        ];
        return new Set(keys.map((key) => String(key).toLowerCase()));
    }, [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]);
    const canManageUserOverrides = baseRole === "superadmin" || isOrganizationAdminRole(baseRole);
    const canManageUserRoles = baseRole === "superadmin" || isOrganizationAdminRole(baseRole);
    const canManageAccess = canManageUserOverrides || canManageUserRoles;

    const isManager = baseRole === "manager";
    const adminId = user?.id;
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : adminId);
    const managerBuildingsQuery = useManagerBuildings(isManager ? adminId : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
    const buildingIds = buildings?.map((building) => building.id) || [];
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);
    const { data: users, isLoading: isUsersLoading } = useAdminUsers(buildingIds);
    const filteredUsers = (users ?? []).filter((entry) => (entry.baseRole ?? entry.role) !== "superadmin");

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const roleCounts = useMemo(() => {
        return filteredUsers.reduce<Record<string, number>>((acc, entry) => {
            const roleKey = getCanonicalRole(entry) ?? entry.role;
            acc[roleKey] = (acc[roleKey] ?? 0) + 1;
            return acc;
        }, {});
    }, [filteredUsers]);

    const visibleUsers = useMemo(() => {
        const term = search.trim().toLowerCase();
        return filteredUsers.filter((entry) => {
            if (roleFilter !== "all" && (getCanonicalRole(entry) ?? entry.role) !== roleFilter) return false;
            if (!term) return true;
            return `${entry.name} ${entry.email}`.toLowerCase().includes(term);
        });
    }, [filteredUsers, roleFilter, search]);

    useEffect(() => {
        const fromQuery = searchParams.get("userId");
        if (fromQuery) {
            setSelectedUserId(fromQuery);
        }
    }, [searchParams]);

    useEffect(() => {
        if (selectedUserId) return;
        if (visibleUsers.length > 0) {
            setSelectedUserId(visibleUsers[0].id);
        }
    }, [selectedUserId, visibleUsers]);

    const selectedUser = useMemo(
        () => filteredUsers.find((entry) => entry.id === selectedUserId) ?? null,
        [filteredUsers, selectedUserId]
    );

    const selectedUserIds = useMemo(() => (selectedUser ? [selectedUser.id] : []), [selectedUser]);
    const { data: roles, isLoading: isRolesLoading } = useRoles({ enabled: canManageUserRoles && !!selectedUser });
    const { data: assignedRoles, isLoading: isAssignedRolesLoading } = useUserRoles(selectedUser?.id, { enabled: !!selectedUser });
    const { data: permissions } = usePermissions({ enabled: canManageUserOverrides });
    const { data: effectivePermissionsData } = useEffectivePermissions(selectedUserIds, { enabled: !!selectedUser });
    const { data: overrideData } = useUserPermissionOverrides(selectedUser?.id, { enabled: !!selectedUser });
    const setUserRoles = useSetUserRoles();
    const setUserPermissions = useSetUserPermissionOverrides();

    const [roleSelection, setRoleSelection] = useState<string[]>([]);
    const [permissionSelection, setPermissionSelection] = useState<string[]>([]);
    const [permissionEffect, setPermissionEffect] = useState<PermissionEffect>("ALLOW");
    const [permissionSearch, setPermissionSearch] = useState("");
    const [customPermission, setCustomPermission] = useState("");
    const [customPermissions, setCustomPermissions] = useState<string[]>([]);

    useEffect(() => {
        if (!selectedUser) {
            setRoleSelection([]);
            setPermissionSelection([]);
            setCustomPermission("");
            return;
        }
        setPermissionEffect("ALLOW");
    }, [selectedUser]);

    useEffect(() => {
        if (!assignedRoles) return;
        if (assignedRoles.length === 0) {
            setRoleSelection((prev) => (prev.length > 0 ? [] : prev));
            return;
        }
        setRoleSelection(assignedRoles.map((roleItem) => roleItem.id));
    }, [assignedRoles]);

    const currentEffectivePermissions = useMemo(() => {
        if (!selectedUser) return [];
        const entry = effectivePermissionsData?.find((item) => String(item.userId) === String(selectedUser.id));
        const list = entry?.permissions ?? [];
        return Array.isArray(list) ? list : [];
    }, [effectivePermissionsData, selectedUser]);

    useEffect(() => {
        if (!selectedUser) return;
        if (permissionSelection.length > 0) return;
        if (currentEffectivePermissions.length === 0) return;
        setPermissionSelection(currentEffectivePermissions);
    }, [currentEffectivePermissions, permissionSelection.length, selectedUser]);

    const currentOverrides = useMemo(() => {
        return Array.isArray(overrideData) ? overrideData : [];
    }, [overrideData]);

    const toggleRoleSelection = (roleId: string) => {
        setRoleSelection((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]);
    };

    const applyRoleAssignments = () => {
        if (!selectedUser) return;
        setUserRoles.mutate(
            { userId: selectedUser.id, roleIds: roleSelection, mode: "replace" },
            {
                onSuccess: () => toast.success("Roles updated"),
                onError: (error) => {
                    const message = error instanceof Error ? error.message : "Failed to assign roles";
                    if (/permission|forbidden|unauthorized/i.test(message)) {
                        toast.error("You don't have permission to assign roles.");
                        return;
                    }
                    toast.error(message);
                },
            }
        );
    };

    const fallbackCatalog = [
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

    const togglePermission = (permissionKey: string) => {
        setPermissionSelection((prev) =>
            prev.includes(permissionKey) ? prev.filter((key) => key !== permissionKey) : [...prev, permissionKey]
        );
    };

    const addCustomPermission = () => {
        const trimmed = customPermission.trim();
        if (!trimmed) return;
        setCustomPermissions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setPermissionSelection((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setCustomPermission("");
    };

    const updatePermissionSelection = (keys: string[], mode: "add" | "remove") => {
        if (keys.length === 0) return;
        setPermissionSelection((prev) => {
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

    const groupedPermissions = useMemo(() => {
        const term = permissionSearch.trim().toLowerCase();
        const filtered = permissionOptions.filter((permission) => {
            if (!term) return true;
            const haystack = `${permission.key} ${permission.label}`.toLowerCase();
            return haystack.includes(term);
        });
        const groups = new Map<string, { label: string; items: typeof filtered }>();
        filtered.forEach((permission) => {
            const [groupKeyRaw] = permission.key.split(".");
            const groupKey = groupKeyRaw || "other";
            const label = groupKey.replace(/[-_]/g, " ");
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

    const applyPermissionOverrides = () => {
        if (!selectedUser) return;
        const normalized = normalizePermissionKeys(permissionSelection);
        if (normalized.length === 0) {
            toast.error("Select at least one permission");
            return;
        }
        setUserPermissions.mutate(
            {
                userId: selectedUser.id,
                overrides: normalized.map((permissionKey) => ({ permissionKey, effect: permissionEffect })),
            },
            {
                onSuccess: () => toast.success(`Permissions ${permissionEffect === "ALLOW" ? "granted" : "revoked"}`),
                onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to update permissions"),
            }
        );
    };

    if (!canManageAccess) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">User Access</h1>
                        <p className="text-sm text-zinc-500">You do not have access to manage user permissions.</p>
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
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">User Access</h1>
                        <p className="mt-1 text-sm text-zinc-500">Assign roles and fine-tune permissions without the modal clutter.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                        <KeyRound className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs uppercase tracking-wide text-zinc-400">Access Control</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <Search className="h-4 w-4 text-zinc-400" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search users..."
                                className="w-full bg-transparent text-sm text-zinc-700 outline-none"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | Role)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles ({filteredUsers.length})</SelectItem>
                                {Object.entries(roleCounts).map(([roleKey, count]) => (
                                    <SelectItem key={roleKey} value={roleKey}>
                                        {roleKey.replace("_", " ")} ({count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                        {isUsersLoading && (
                            <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">
                                Loading users...
                            </div>
                        )}
                        {!isUsersLoading && visibleUsers.length === 0 && (
                            <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">
                                No users match this filter.
                            </div>
                        )}
                        {visibleUsers.map((entry) => {
                            const isActive = entry.id === selectedUserId;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => setSelectedUserId(entry.id)}
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                        isActive
                                            ? "border-zinc-900 bg-zinc-900 text-white"
                                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-zinc-900"}`}>
                                                {entry.name}
                                            </p>
                                            <p className={`text-xs ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
                                                {entry.email}
                                            </p>
                                        </div>
                                        <div className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-wide ${
                                            isActive ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-500"
                                        }`}>
                                            {formatRoleLabel(entry.role, getCanonicalRole(entry))}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                        {!selectedUser ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                                Select a user to view and edit access.
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                                            <UserRound className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-zinc-900">{selectedUser.name}</h2>
                                            <p className="text-sm text-zinc-500">{selectedUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                            {formatRoleLabel(selectedUser.role, getCanonicalRole(selectedUser))}
                                        </Badge>
                                        {selectedUser.buildingIds.length > 0 ? (
                                            selectedUser.buildingIds.map((buildingId) => (
                                                <Badge key={buildingId} variant="secondary" className="bg-zinc-100 text-zinc-600">
                                                    {buildingNameById[buildingId] ?? buildingId}
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                                Global access
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Effective permissions</p>
                                    {currentEffectivePermissions.length === 0 ? (
                                        <p className="mt-2 text-xs text-zinc-500">No permissions returned.</p>
                                    ) : (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {currentEffectivePermissions.slice(0, 10).map((permission) => (
                                                <Badge key={permission} variant="secondary" className="bg-white text-zinc-600">
                                                    {permission}
                                                </Badge>
                                            ))}
                                            {currentEffectivePermissions.length > 10 && (
                                                <Badge variant="secondary" className="bg-white text-zinc-600">
                                                    +{currentEffectivePermissions.length - 10} more
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedUser && (
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Roles</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">{roleSelection.length}</p>
                                    <p className="text-xs text-zinc-500">Assigned</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Overrides</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">{currentOverrides.length}</p>
                                    <p className="text-xs text-zinc-500">Active</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Effective</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">{currentEffectivePermissions.length}</p>
                                    <p className="text-xs text-zinc-500">Permissions</p>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">Selected</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">{permissionSelection.length}</p>
                                    <p className="text-xs text-zinc-500">For update</p>
                                </div>
                            </div>

                            <details open className="rounded-2xl border border-zinc-200 bg-white p-6">
                                <summary className="flex cursor-pointer items-start justify-between gap-4 list-none">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900">Roles</p>
                                        <p className="mt-1 text-sm text-zinc-500">Assign role templates for this user.</p>
                                    </div>
                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                        {roleSelection.length} selected
                                    </Badge>
                                </summary>
                                <div className="mt-4">
                                    {canManageUserRoles && (
                                        <div className="flex justify-end">
                                            <Button type="button" onClick={applyRoleAssignments} disabled={setUserRoles.isPending}>
                                                Save roles
                                            </Button>
                                        </div>
                                    )}

                                    {!canManageUserRoles ? (
                                        <p className="mt-4 text-sm text-zinc-500">You do not have permission to assign roles.</p>
                                    ) : isRolesLoading || isAssignedRolesLoading ? (
                                        <p className="mt-4 text-sm text-zinc-500">Loading roles...</p>
                                    ) : roles && roles.length > 0 ? (
                                        <div className="mt-4 space-y-3">
                                            {roles.map((roleEntry) => (
                                                <label
                                                    key={roleEntry.id}
                                                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-zinc-900">{roleEntry.name}</p>
                                                            {roleEntry.description && (
                                                                <p className="text-xs text-zinc-500">{roleEntry.description}</p>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={roleSelection.includes(roleEntry.id)}
                                                            onChange={() => toggleRoleSelection(roleEntry.id)}
                                                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                                                        />
                                                    </div>
                                                    {Array.isArray(roleEntry.permissionKeys) && roleEntry.permissionKeys.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {roleEntry.permissionKeys.map((permission) => (
                                                                <Badge key={`${roleEntry.id}-${permission}`} variant="secondary" className="bg-white text-zinc-600">
                                                                    {permission}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-zinc-500">No permissions listed for this role.</p>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-4 text-sm text-zinc-500">No roles returned.</p>
                                    )}
                                </div>
                            </details>

                            <details open className="rounded-2xl border border-zinc-200 bg-white p-6">
                                <summary className="flex cursor-pointer items-start justify-between gap-4 list-none">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900">Permission overrides</p>
                                        <p className="mt-1 text-sm text-zinc-500">Grant or revoke specific keys for this user.</p>
                                    </div>
                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                        {currentOverrides.length} active
                                    </Badge>
                                </summary>

                                <div className="mt-4 space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Apply changes</p>
                                            <p className="mt-1 text-sm text-zinc-500">Effect applies to selected permissions.</p>
                                        </div>
                                        <Button type="button" onClick={applyPermissionOverrides} disabled={setUserPermissions.isPending}>
                                            Apply overrides
                                        </Button>
                                    </div>

                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Effect</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {(["ALLOW", "DENY"] as PermissionEffect[]).map((effect) => (
                                                <button
                                                    key={effect}
                                                    type="button"
                                                    onClick={() => setPermissionEffect(effect)}
                                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                                        permissionEffect === effect
                                                            ? "border-zinc-900 bg-zinc-900 text-white"
                                                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                                                    }`}
                                                >
                                                    {effect === "ALLOW" ? "Grant" : "Revoke"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {currentOverrides.length > 0 && (
                                        <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Current overrides</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {currentOverrides.map((override) => (
                                                    <Badge key={`${override.permissionKey}-${override.effect}`} variant="secondary" className="bg-zinc-100 text-zinc-600">
                                                        {override.permissionKey}:{override.effect}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add custom key</p>
                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                            <input
                                                type="text"
                                                value={customPermission}
                                                onChange={(event) => setCustomPermission(event.target.value)}
                                                placeholder="e.g. unitTypes.write"
                                                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                            />
                                            <Button type="button" variant="outline" onClick={addCustomPermission}>
                                                Add
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                                            <Search className="h-4 w-4 text-zinc-400" />
                                            <input
                                                type="search"
                                                value={permissionSearch}
                                                onChange={(event) => setPermissionSearch(event.target.value)}
                                                placeholder="Search permissions..."
                                                className="w-full bg-transparent text-sm text-zinc-700 outline-none"
                                            />
                                        </div>

                                        <div className="mt-3 space-y-4">
                                            {groupedPermissions.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">
                                                    No permissions match this search.
                                                </div>
                                            ) : (
                                                groupedPermissions.map((group) => {
                                                    const groupKeys = group.items.map((item) => item.key);
                                                    const selectedCount = groupKeys.filter((key) => permissionSelection.includes(key)).length;
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
                                                        <div key={group.key} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
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
                                                                        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={permissionSelection.includes(permission.key)}
                                                                            onChange={() => togglePermission(permission.key)}
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
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
