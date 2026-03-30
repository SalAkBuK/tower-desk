"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/users/UsersTable";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { portalPath } from "@/lib/portalPaths";
import {
    hasCanonicalRole,
    isBuildingAdminRole,
    isBuildingScopedPortalRole,
    isOrganizationAdminRole,
} from "@/lib/roles";
import { useAccessibleBuildings, useAdminUsers, useDeleteUser } from "@/lib/queries";
import type { BaseRole, User } from "@/lib/types";

type UserDirectoryTab = "org_admin" | "building_admin" | "manager" | "employee" | "tenant";

export function PortalUsersPage() {
    const { user, baseRole, login, token } = useAuth();
    const router = useRouter();
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole);
    const buildings = accessibleBuildingsQuery.data ?? [];
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = buildings.map((building) => building.id);
    const buildingOptions = buildings.map((building) => ({ id: building.id, name: building.name }));
    const canManageUserOverrides = baseRole === "superadmin" || isOrganizationAdminRole(baseRole);
    const canManageUserRoles = baseRole === "superadmin" || isOrganizationAdminRole(baseRole);
    const canManageUserAccess = canManageUserOverrides || canManageUserRoles;
    const canShowOrgTabs = canManageUserAccess;
    const canShowBuildingAdminTab = canShowOrgTabs || isBuildingScopedPortalRole(baseRole);
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canWriteUsers =
        hasPermission(permissionSet, "users.write") ||
        hasPermissionPrefix(permissionSet, "users.write") ||
        hasPermission(permissionSet, "users.create") ||
        hasPermissionPrefix(permissionSet, "users.create");
    const deleteUser = useDeleteUser();
    const { data: users, isLoading: isUsersLoading } = useAdminUsers(buildingIds);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        if (!user || buildingIds.length === 0) return;
        const currentIds = user.buildingIds || [];
        const sameLength = buildingIds.length === currentIds.length;
        const hasAll = buildingIds.every((id) => currentIds.includes(id));
        if (sameLength && hasAll) return;
        login({ ...user, buildingIds }, token);
    }, [buildingIds, login, token, user]);

    const buildingNameById = useMemo(() => {
        return buildings.reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);

    const filteredUsers = useMemo(
        () => (users ?? []).filter((entry) => (entry.baseRole ?? entry.role) !== "superadmin"),
        [users]
    );
    const orgAdmins = filteredUsers.filter((entry) => entry.orgRoleKeys?.includes("org_admin"));
    const buildingAdmins = filteredUsers.filter((entry) => isBuildingAdminRole(entry));
    const tenantUsers = filteredUsers.filter((entry) => (entry.baseRole ?? entry.role) === "tenant");
    const isLoading = isBuildingsLoading || isUsersLoading;

    const getCount = (role: BaseRole) => filteredUsers.filter((entry) => hasCanonicalRole(entry, role)).length;
    const totalUsers = filteredUsers.length;
    const canDeleteRole = (role: string) => role === "manager" || role === "tenant" || role === "employee";
    const permissionActions = canManageUserAccess
        ? [
            {
                label: "Manage access",
                icon: <ShieldCheck className="w-4 h-4 mr-2" />,
                onSelect: (target: User) => router.push(`${portalPath("access")}?userId=${target.id}`),
            },
        ]
        : undefined;

    const tenantsByBuilding = useMemo(() => {
        const map = new Map<string, typeof tenantUsers>();
        tenantUsers.forEach((tenant) => {
            const assignedBuildingIds = tenant.buildingIds.length > 0 ? tenant.buildingIds : ["unassigned"];
            assignedBuildingIds.forEach((buildingId) => {
                const existing = map.get(buildingId) ?? [];
                existing.push(tenant);
                map.set(buildingId, existing);
            });
        });
        return map;
    }, [tenantUsers]);

    const defaultTab: UserDirectoryTab = canShowOrgTabs
        ? "manager"
        : canShowBuildingAdminTab
            ? "building_admin"
            : "manager";

    const visibleTabs = [
        canShowOrgTabs ? { value: "org_admin" as const, label: "Org Admins", count: orgAdmins.length } : null,
        canShowBuildingAdminTab ? { value: "building_admin" as const, label: "Building Admins", count: buildingAdmins.length } : null,
        { value: "manager" as const, label: "Managers", count: getCount("manager") },
        { value: "employee" as const, label: "Maintenance Staff", count: getCount("employee") },
        { value: "tenant" as const, label: "Tenants", count: getCount("tenant") },
    ].filter(Boolean) as { value: UserDirectoryTab; label: string; count: number }[];

    const renderDirectoryTable = (entries: User[] | undefined) => (
        <UsersTable
            users={entries}
            isLoading={isLoading}
            buildingNameById={buildingNameById}
            actions={permissionActions}
            onDelete={canWriteUsers ? (target) =>
                deleteUser.mutate(
                    { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                    {
                        onSuccess: () => toast.success("User deleted"),
                        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                    }
                ) : undefined}
            canDelete={canWriteUsers ? (entry) => canDeleteRole(entry.baseRole ?? entry.role) : undefined}
        />
    );

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Users</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage roles, assignments, and access across your accessible buildings.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                                <Building2 className="h-4 w-4 text-zinc-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Buildings</span>
                                <span className="text-sm font-semibold text-zinc-900">{buildingOptions.length}</span>
                            </div>
                        </div>
                        {canWriteUsers ? (
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Add User
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "Total Users", value: totalUsers, icon: Users, color: "bg-blue-50 text-blue-700" },
                        { label: "Org Admins", value: orgAdmins.length, icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700" },
                        { label: "Managers", value: getCount("manager"), icon: UserRound, color: "bg-amber-50 text-amber-700" },
                        { label: "Staff", value: getCount("employee"), icon: Users, color: "bg-zinc-100 text-zinc-700" },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white p-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div className="mt-3 text-2xl font-bold text-zinc-900">{stat.value}</div>
                            <p className="text-xs text-zinc-500">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <Tabs defaultValue={defaultTab} className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Directory</h2>
                            <p className="text-xs text-zinc-400">Filter by role to keep permissions tidy.</p>
                        </div>
                        <TabsList className="bg-zinc-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap">
                            {visibleTabs.map((tab) => (
                                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                                    {tab.label}{" "}
                                    <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">
                                        {tab.count}
                                    </Badge>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    {canShowOrgTabs ? (
                        <TabsContent value="org_admin" className="mt-6">
                            {renderDirectoryTable(orgAdmins.map((entry) => ({ ...entry, role: "org_admin", baseRole: "org_admin" })))}
                        </TabsContent>
                    ) : null}

                    {canShowBuildingAdminTab ? (
                        <TabsContent value="building_admin" className="mt-6">
                            {renderDirectoryTable(buildingAdmins)}
                        </TabsContent>
                    ) : null}

                    <TabsContent value="manager" className="mt-6">
                        {renderDirectoryTable(filteredUsers.filter((entry) => (entry.baseRole ?? entry.role) === "manager"))}
                    </TabsContent>

                    <TabsContent value="employee" className="mt-6">
                        {renderDirectoryTable(filteredUsers.filter((entry) => (entry.baseRole ?? entry.role) === "employee"))}
                    </TabsContent>

                    <TabsContent value="tenant" className="mt-6">
                        <div className="space-y-6">
                            {tenantUsers.length === 0 ? (
                                renderDirectoryTable([])
                            ) : (
                                <>
                                    {buildingOptions.map((building) => {
                                        const tenants = tenantsByBuilding.get(building.id) ?? [];
                                        if (tenants.length === 0) return null;
                                        return (
                                            <div key={building.id} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-zinc-900">{building.name}</h3>
                                                        <p className="text-xs text-zinc-400">Tenants assigned to this building.</p>
                                                    </div>
                                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                        {tenants.length}
                                                    </Badge>
                                                </div>
                                                {renderDirectoryTable(tenants)}
                                            </div>
                                        );
                                    })}
                                    {tenantsByBuilding.has("unassigned") ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-zinc-900">Unassigned</h3>
                                                    <p className="text-xs text-zinc-400">Tenants missing a building assignment.</p>
                                                </div>
                                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                    {tenantsByBuilding.get("unassigned")?.length ?? 0}
                                                </Badge>
                                            </div>
                                            {renderDirectoryTable(tenantsByBuilding.get("unassigned"))}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <CreateUserSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                defaultRole="manager"
                hideAdminRole={!canShowOrgTabs}
                buildingOptions={buildingOptions}
                requireBuildingAssignment
            />
        </div>
    );
}
