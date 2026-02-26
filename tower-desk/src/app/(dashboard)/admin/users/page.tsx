"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { UsersTable } from "@/components/users/UsersTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { useAdminBuildings, useAdminUsers, useDeleteUser } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { portalPath } from "@/lib/portalPaths";

export default function AdminUsersPage() {
    const { user, baseRole } = useAuth();
    const router = useRouter();
    const permissionKeys = useMemo(() => {
        const keys = [
            ...(user?.effectivePermissions ?? []),
            ...(user?.roleKeys ?? []),
            ...(user?.orgRoleKeys ?? []),
        ];
        return new Set(keys.map((key) => String(key).toLowerCase()));
    }, [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]);
    const canManageUserOverrides = baseRole === 'superadmin'
        || baseRole === 'org_admin'
        || baseRole === 'admin'
        || permissionKeys.has('users.write');
    const canManageUserRoles = baseRole === 'superadmin'
        || baseRole === 'org_admin'
        || baseRole === 'admin'
        || permissionKeys.has('roles.write');
    const adminId = user?.id;
    const { data: buildings, isLoading: isBuildingsLoading } = useAdminBuildings(adminId);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const buildingOptions = buildings?.map((building) => ({ id: building.id, name: building.name })) || [];
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);
    const { data: users, isLoading: isUsersLoading } = useAdminUsers(buildingIds);
    const deleteUser = useDeleteUser();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const canManageUserAccess = canManageUserOverrides || canManageUserRoles;

    const filteredUsers = users?.filter((u) => (u.baseRole ?? u.role) !== 'superadmin');
    const orgAdmins = filteredUsers?.filter((user) => user.orgRoleKeys?.includes('org_admin')) || [];
    const tenantUsers = filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'tenant') || [];
    const getCount = (role: string) => filteredUsers?.filter((u) => (u.baseRole ?? u.role) === role).length || 0;
    const totalUsers = filteredUsers?.length || 0;
    const isLoading = isBuildingsLoading || isUsersLoading;
    const canDelete = (role: string) => role === 'manager' || role === 'tenant' || role === 'employee';
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
            const buildingIdsForTenant = tenant.buildingIds.length > 0 ? tenant.buildingIds : ["unassigned"];
            buildingIdsForTenant.forEach((buildingId) => {
                const key = String(buildingId);
                const existing = map.get(key) ?? [];
                existing.push(tenant);
                map.set(key, existing);
            });
        });
        return map;
    }, [tenantUsers]);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Building Management</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage roles, assignments, and access across your portfolio.</p>
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
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
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
                <Tabs defaultValue="manager" className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Directory</h2>
                            <p className="text-xs text-zinc-400">Filter by role to keep permissions tidy.</p>
                        </div>
                        <TabsList className="bg-zinc-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap">
                            <TabsTrigger value="org_admin" className="gap-2">
                                Org Admins <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{orgAdmins.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="admin" className="gap-2">
                                Admins <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('admin')}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="manager" className="gap-2">
                                Managers <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('manager')}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="employee" className="gap-2">
                                Maintenance Staff <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('employee')}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="tenant" className="gap-2">
                                Tenants <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300">{getCount('tenant')}</Badge>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="admin" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'admin')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        actions={permissionActions}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                    </TabsContent>
                    <TabsContent value="org_admin" className="mt-6">
                    <UsersTable
                        users={orgAdmins.map((user) => ({ ...user, role: 'org_admin', baseRole: 'org_admin' }))}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        actions={permissionActions}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                    </TabsContent>
                    <TabsContent value="manager" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'manager')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        actions={permissionActions}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                    </TabsContent>
                    <TabsContent value="employee" className="mt-6">
                    <UsersTable
                        users={filteredUsers?.filter((u) => (u.baseRole ?? u.role) === 'employee')}
                        isLoading={isLoading}
                        buildingNameById={buildingNameById}
                        actions={permissionActions}
                        onDelete={(target) =>
                            deleteUser.mutate(
                                { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                {
                                    onSuccess: () => toast.success("User deleted"),
                                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                }
                            )
                        }
                        canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                    />
                    </TabsContent>
                    <TabsContent value="tenant" className="mt-6">
                        <div className="space-y-6">
                            {tenantUsers.length === 0 ? (
                                <UsersTable
                                    users={[]}
                                    isLoading={isLoading}
                                    buildingNameById={buildingNameById}
                                    actions={permissionActions}
                                />
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
                                                <UsersTable
                                                    users={tenants}
                                                    isLoading={isLoading}
                                                    buildingNameById={buildingNameById}
                                                    actions={permissionActions}
                                                    onDelete={(target) =>
                                                        deleteUser.mutate(
                                                            { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                                            {
                                                                onSuccess: () => toast.success("User deleted"),
                                                                onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                                            }
                                                        )
                                                    }
                                                    canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                                                />
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
                                            <UsersTable
                                                users={tenantsByBuilding.get("unassigned")}
                                                isLoading={isLoading}
                                                buildingNameById={buildingNameById}
                                                actions={permissionActions}
                                                onDelete={(target) =>
                                                    deleteUser.mutate(
                                                        { role: target.baseRole ?? target.role, id: target.id, buildingIds: target.buildingIds },
                                                        {
                                                            onSuccess: () => toast.success("User deleted"),
                                                            onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete user"),
                                                        }
                                                    )
                                                }
                                                canDelete={(u) => canDelete(u.baseRole ?? u.role)}
                                            />
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
                buildingOptions={buildingOptions}
                requireBuildingAssignment={true}
            />
        </div>
    );
}
