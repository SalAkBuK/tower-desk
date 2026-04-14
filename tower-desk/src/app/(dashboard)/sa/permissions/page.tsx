"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/queries";

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
    { key: "platform.delivery_tasks.read", label: "Platform Delivery Tasks: Read" },
    { key: "platform.delivery_tasks.retry", label: "Platform Delivery Tasks: Retry" },
    { key: "platform.delivery_tasks.cleanup", label: "Platform Delivery Tasks: Cleanup" },
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
    { key: "visitors.read", label: "Visitors: Read" },
    { key: "visitors.create", label: "Visitors: Create" },
    { key: "visitors.update", label: "Visitors: Update" },
];

const formatGroupLabel = (value: string) =>
    value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export default function SuperadminPermissionsPage() {
    const { data: permissions } = usePermissions();
    const [search, setSearch] = useState("");

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
        const missingFallbackEntries = FALLBACK_CATALOG.filter((permission) => !backendKeys.has(permission.key));
        return [...backendPermissions, ...missingFallbackEntries];
    }, [permissions]);

    const groupedPermissions = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const filtered = permissionCatalog.filter((permission) => {
            if (!normalizedSearch) return true;
            const haystack = `${permission.key} ${permission.label}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });

        const groups = new Map<string, { label: string; items: typeof filtered }>();
        filtered.forEach((permission) => {
            const [groupKeyRaw] = permission.key.split(".");
            const groupKey = groupKeyRaw || "other";
            const existing = groups.get(groupKey) ?? {
                label: formatGroupLabel(groupKey),
                items: [],
            };
            existing.items.push(permission);
            groups.set(groupKey, existing);
        });

        return Array.from(groups.entries())
            .map(([key, value]) => ({
                key,
                label: value.label,
                items: [...value.items].sort((left, right) => left.key.localeCompare(right.key)),
            }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [permissionCatalog, search]);

    const platformPermissionCount = useMemo(
        () => permissionCatalog.filter((permission) => permission.key.startsWith("platform.")).length,
        [permissionCatalog]
    );

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Platform Permissions</h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Read-only permission catalog for the platform portal. Org role templates remain org-scoped, so this screen does not edit roles from the superadmin context.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs uppercase tracking-wide text-zinc-400">Superadmin</span>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                        {permissionCatalog.length} total permissions
                    </Badge>
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                        {platformPermissionCount} platform permissions
                    </Badge>
                    <Badge variant="outline" className="border-zinc-200 text-zinc-600">
                        {permissions && permissions.length > 0 ? "Backend catalog" : "Fallback catalog"}
                    </Badge>
                </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                Role template APIs such as <span className="font-mono">/role-templates</span> are org-scoped on this backend. Calling them from the platform portal produces the 403s you saw. If platform-wide role management is ever added, it needs dedicated platform endpoints, not reuse of the org editor.
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-6">
                <div className="max-w-md">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Search Permissions
                    </label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by key or label"
                            className="w-full rounded-xl border border-zinc-200 px-10 py-2.5 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
                        />
                    </div>
                </div>

                {groupedPermissions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                        No permissions match this search.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedPermissions.map((group) => (
                            <section key={group.key} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-sm font-semibold capitalize text-zinc-900">{group.label}</h2>
                                        <p className="text-xs text-zinc-500">{group.items.length} permission{group.items.length === 1 ? "" : "s"}</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                                    {group.items.map((permission) => (
                                        <div key={permission.key} className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                                            <div className="text-sm font-medium text-zinc-900">{permission.label}</div>
                                            <div className="mt-1 break-all font-mono text-xs text-zinc-500">{permission.key}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
