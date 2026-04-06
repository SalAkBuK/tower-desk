"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, ShieldCheck, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UsersTable } from "@/components/users/UsersTable";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { portalPath } from "@/lib/portalPaths";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { getUserAccessView } from "@/lib/userAccess";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import { useAccessibleBuildings, useAdminUsers } from "@/lib/queries";
import type { User } from "@/lib/types";

export function PortalUsersPage() {
    const { user, baseRole, login, token } = useAuth();
    const router = useRouter();
    const permissionSet = getUserPermissionSet(user);
    const usersModuleRule = getPortalModuleByKey("users")?.rule;
    const canReadUsers = Boolean(usersModuleRule && hasAnyPermission(permissionSet, usersModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canReadUsers });
    const buildings = useMemo(() => accessibleBuildingsQuery.data ?? [], [accessibleBuildingsQuery.data]);
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = buildings.map((building) => building.id);
    const buildingOptions = buildings.map((building) => ({ id: building.id, name: building.name }));
    const canManageUserAccess = baseRole === "superadmin" || hasRbacPermission(user, "users.write");
    const canShowOrgTabs = canManageUserAccess;
    const canWriteUsers =
        baseRole === "superadmin"
        || hasRbacPermission(user, "users.write")
        || hasRbacPermission(user, "users.create");
    const { data: users, isLoading: isUsersLoading } = useAdminUsers(buildingIds, { enabled: canReadUsers && buildingIds.length > 0 });
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
    const accessStats = useMemo(() => {
        return filteredUsers.reduce(
            (acc, entry) => {
                const access = getUserAccessView(entry);
                const hasOrgAccess = access.orgAccess.length > 0;
                const hasBuildingAccess = access.buildingAccess.length > 0;
                const hasResident = Boolean(access.resident);
                if (hasOrgAccess) acc.orgAccess += 1;
                if (!hasOrgAccess && hasBuildingAccess && !hasResident) acc.buildingOnly += 1;
                if (!hasOrgAccess && hasResident && !hasBuildingAccess) acc.residentOnly += 1;
                if (hasOrgAccess && (hasBuildingAccess || hasResident)) acc.mixed += 1;
                return acc;
            },
            { orgAccess: 0, buildingOnly: 0, residentOnly: 0, mixed: 0 }
        );
    }, [filteredUsers]);
    const isLoading = isBuildingsLoading || isUsersLoading;
    const totalUsers = filteredUsers.length;
    const permissionActions = canManageUserAccess
        ? [
            {
                label: "Manage access",
                icon: <ShieldCheck className="w-4 h-4 mr-2" />,
                onSelect: (target: User) => router.push(`${portalPath("access")}?userId=${target.id}`),
            },
        ]
        : undefined;

    const renderDirectoryTable = (entries: User[] | undefined) => (
        <UsersTable
            users={entries}
            isLoading={isLoading}
            buildingNameById={buildingNameById}
            actions={permissionActions}
        />
    );

    if (!canReadUsers) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Users</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view users.</p>
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
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Users</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage Org Access, Building Access, Resident Access, and permission exceptions.</p>
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
                        { label: "Org Access", value: accessStats.orgAccess, icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700" },
                        { label: "Building Only", value: accessStats.buildingOnly, icon: Building2, color: "bg-amber-50 text-amber-700" },
                        { label: "Resident Only", value: accessStats.residentOnly, icon: UserRound, color: "bg-zinc-100 text-zinc-700" },
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">Directory</h2>
                        <p className="text-xs text-zinc-400">Org Access is separated from Building Access and Resident Access.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Mixed access {accessStats.mixed}</Badge>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Org access {accessStats.orgAccess}</Badge>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Building only {accessStats.buildingOnly}</Badge>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Resident only {accessStats.residentOnly}</Badge>
                    </div>
                </div>

                <div className="mt-6">
                    {renderDirectoryTable(filteredUsers)}
                </div>
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
