"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock3, Plus, ShieldCheck, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/users/UsersTable";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { portalPath } from "@/lib/portalPaths";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { useAccessibleBuildings, useAdminUsers } from "@/lib/queries";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import type { User } from "@/lib/types";
import { getUserDirectorySummary, type ManagementStaffFilter, type UserDirectoryTab } from "@/lib/userDirectoryPresentation";

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
    const [activeTab, setActiveTab] = useState<UserDirectoryTab>("management_staff");
    const [staffFilter, setStaffFilter] = useState<ManagementStaffFilter>("all");

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
    const isLoading = isBuildingsLoading || isUsersLoading;
    const permissionActions = canManageUserAccess
        ? [
            {
                label: "Manage access",
                icon: <ShieldCheck className="w-4 h-4 mr-2" />,
                onSelect: (target: User) => router.push(`${portalPath("access")}?userId=${target.id}`),
            },
        ]
        : undefined;

    const directoryEntries = useMemo(
        () => filteredUsers.map((entry) => ({
            user: entry,
            summary: getUserDirectorySummary(entry, buildingNameById),
        })),
        [buildingNameById, filteredUsers]
    );
    const directoryCounts = useMemo(
        () => directoryEntries.reduce(
            (acc, entry) => {
                acc[entry.summary.tab] += 1;
                if (entry.summary.tab === "management_staff") {
                    acc.staffFilters.all += 1;
                    if (entry.summary.filter !== "all") {
                        acc.staffFilters[entry.summary.filter] += 1;
                    }
                }
                return acc;
            },
            {
                management_staff: 0,
                residents: 0,
                pending_setup: 0,
                inactive: 0,
                staffFilters: {
                    all: 0,
                    org_wide: 0,
                    building_scoped: 0,
                    mixed: 0,
                } satisfies Record<ManagementStaffFilter, number>,
            }
        ),
        [directoryEntries]
    );
    const visibleUsers = useMemo(() => {
        return directoryEntries
            .filter((entry) => entry.summary.tab === activeTab)
            .filter((entry) => activeTab !== "management_staff" || staffFilter === "all" || entry.summary.filter === staffFilter)
            .map((entry) => entry.user);
    }, [activeTab, directoryEntries, staffFilter]);

    const emptyMessageByTab: Record<UserDirectoryTab, string> = {
        management_staff: "No management or staff users match this view.",
        residents: "No resident-linked users found.",
        pending_setup: "No pending setup users found.",
        inactive: "No inactive users found.",
    };

    const renderDirectoryTable = (entries: User[] | undefined, emptyMessage: string) => (
        <UsersTable
            users={entries}
            isLoading={isLoading}
            buildingNameById={buildingNameById}
            emptyMessage={emptyMessage}
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
                        <h1 className="text-lg font-semibold text-zinc-900">People &amp; Access</h1>
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
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">People &amp; Access</h1>
                        <p className="mt-1 text-sm text-zinc-500">Review who has access, what their main role is, and where that access applies.</p>
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
                        { label: "Management & Staff", value: directoryCounts.management_staff, icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700" },
                        { label: "Residents", value: directoryCounts.residents, icon: UserRound, color: "bg-blue-50 text-blue-700" },
                        { label: "Pending Setup", value: directoryCounts.pending_setup, icon: Clock3, color: "bg-amber-50 text-amber-700" },
                        { label: "Inactive", value: directoryCounts.inactive, icon: Users, color: "bg-zinc-100 text-zinc-700" },
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
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">People</h2>
                        <p className="text-xs text-zinc-400">Primary Access shows the main role. Scope shows where that access applies. Open a row for the full breakdown.</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UserDirectoryTab)} className="gap-4">
                        <TabsList className="h-auto flex-wrap rounded-lg bg-zinc-100 p-1">
                            <TabsTrigger value="management_staff" className="gap-2">
                                Management &amp; Staff
                                <Badge variant="secondary" className="bg-white text-zinc-700">{directoryCounts.management_staff}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="residents" className="gap-2">
                                Residents
                                <Badge variant="secondary" className="bg-white text-zinc-700">{directoryCounts.residents}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="pending_setup" className="gap-2">
                                Pending Setup
                                <Badge variant="secondary" className="bg-white text-zinc-700">{directoryCounts.pending_setup}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="inactive" className="gap-2">
                                Inactive
                                <Badge variant="secondary" className="bg-white text-zinc-700">{directoryCounts.inactive}</Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {activeTab === "management_staff" ? (
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: "all", label: "All", count: directoryCounts.management_staff },
                                { key: "org_wide", label: "Org-wide", count: directoryCounts.staffFilters.org_wide },
                                { key: "building_scoped", label: "Building-scoped", count: directoryCounts.staffFilters.building_scoped },
                                { key: "mixed", label: "Mixed", count: directoryCounts.staffFilters.mixed },
                            ].map((filterOption) => (
                                <Button
                                    key={filterOption.key}
                                    type="button"
                                    variant={staffFilter === filterOption.key ? "default" : "outline"}
                                    className="h-8 rounded-full"
                                    onClick={() => setStaffFilter(filterOption.key as ManagementStaffFilter)}
                                >
                                    {filterOption.label}
                                    <Badge
                                        variant="secondary"
                                        className={staffFilter === filterOption.key ? "bg-white/90 text-zinc-900" : "bg-zinc-100 text-zinc-700"}
                                    >
                                        {filterOption.count}
                                    </Badge>
                                </Button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="mt-6">
                    {renderDirectoryTable(visibleUsers, emptyMessageByTab[activeTab])}
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
