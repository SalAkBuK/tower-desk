"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock3, Plus, Search, ShieldCheck, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type DirectoryEntry = {
    user: User;
    summary: ReturnType<typeof getUserDirectorySummary>;
};

type DirectoryCounts = {
    management_staff: number;
    residents: number;
    pending_setup: number;
    inactive: number;
    staffFilters: Record<ManagementStaffFilter, number>;
};

const USER_TAB_LABELS: Record<UserDirectoryTab, string> = {
    management_staff: "Management & Staff",
    residents: "Residents",
    pending_setup: "Pending Setup",
    inactive: "Inactive",
};

const STAFF_FILTER_LABELS: Record<ManagementStaffFilter, string> = {
    all: "All staff scopes",
    org_wide: "Org-wide",
    building_scoped: "Building-scoped",
    mixed: "Mixed scope",
};

const createEmptyDirectoryCounts = (): DirectoryCounts => ({
    management_staff: 0,
    residents: 0,
    pending_setup: 0,
    inactive: 0,
    staffFilters: {
        all: 0,
        org_wide: 0,
        building_scoped: 0,
        mixed: 0,
    },
});

const countDirectoryEntries = (entries: DirectoryEntry[]): DirectoryCounts =>
    entries.reduce((acc, entry) => {
        acc[entry.summary.tab] += 1;
        if (entry.summary.tab === "management_staff") {
            acc.staffFilters.all += 1;
            if (entry.summary.filter !== "all") {
                acc.staffFilters[entry.summary.filter] += 1;
            }
        }
        return acc;
    }, createEmptyDirectoryCounts());

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
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);

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
                icon: <ShieldCheck className="mr-2 h-4 w-4" />,
                onSelect: (target: User) => router.push(`${portalPath("access")}?userId=${target.id}`),
            },
        ]
        : undefined;

    const directoryEntries = useMemo<DirectoryEntry[]>(
        () => filteredUsers.map((entry) => ({
            user: entry,
            summary: getUserDirectorySummary(entry, buildingNameById),
        })),
        [buildingNameById, filteredUsers]
    );

    const totalDirectoryCounts = useMemo(
        () => countDirectoryEntries(directoryEntries),
        [directoryEntries]
    );

    const searchedDirectoryEntries = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();
        if (!term) return directoryEntries;
        return directoryEntries.filter(({ user, summary }) =>
            [
                user.name,
                user.email,
                user.phoneNumber,
                user.baseRole,
                user.role,
                summary.primaryAccess,
                summary.scope,
                summary.detailResidentLink,
                summary.detailSetupState,
                ...summary.detailOrgRoles,
                ...summary.detailBuildingAssignments,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term))
        );
    }, [deferredSearch, directoryEntries]);

    const filteredDirectoryCounts = useMemo(
        () => countDirectoryEntries(searchedDirectoryEntries),
        [searchedDirectoryEntries]
    );

    const visibleUsers = useMemo(() => {
        return searchedDirectoryEntries
            .filter((entry) => entry.summary.tab === activeTab)
            .filter((entry) => activeTab !== "management_staff" || staffFilter === "all" || entry.summary.filter === staffFilter)
            .map((entry) => entry.user);
    }, [activeTab, searchedDirectoryEntries, staffFilter]);

    const emptyMessageByTab: Record<UserDirectoryTab, string> = {
        management_staff: "No management or staff users match this view.",
        residents: "No resident-linked users found.",
        pending_setup: "No pending setup users found.",
        inactive: "No inactive users found.",
    };

    const emptyMessage = deferredSearch.trim()
        ? `${emptyMessageByTab[activeTab]} Adjust the search term or filters.`
        : emptyMessageByTab[activeTab];

    const renderDirectoryTable = (entries: User[] | undefined, tableEmptyMessage: string) => (
        <UsersTable
            users={entries}
            isLoading={isLoading}
            buildingNameById={buildingNameById}
            emptyMessage={tableEmptyMessage}
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

    const activeTabLabel = USER_TAB_LABELS[activeTab];
    const activeStaffFilterLabel = STAFF_FILTER_LABELS[staffFilter];

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
                                People &amp; Access
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                                Review the active user directory, verify access scope, and route org-wide permission updates from one place.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
                            <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                            Directory Scope
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-zinc-950">
                                            {buildingOptions.length} accessible building{buildingOptions.length === 1 ? "" : "s"}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-500">
                                            Org roles, building assignments, and resident-linked accounts are shown in one directory.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {canWriteUsers ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button onClick={() => setIsCreateOpen(true)} className="h-11 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add User
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{totalDirectoryCounts.management_staff}</div>
                    <p className="mt-1 text-sm text-zinc-500">Management &amp; staff</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <UserRound className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{totalDirectoryCounts.residents}</div>
                    <p className="mt-1 text-sm text-zinc-500">Resident-linked users</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <Clock3 className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{totalDirectoryCounts.pending_setup}</div>
                    <p className="mt-1 text-sm text-zinc-500">Pending setup</p>
                </div>
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{totalDirectoryCounts.inactive}</div>
                    <p className="mt-1 text-sm text-zinc-500">Inactive users</p>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">User Directory</h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                Search users by name, contact details, access role, or scope, then expand rows for the full access breakdown.
                            </p>
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search users"
                                className="h-11 rounded-xl border-zinc-200 bg-white pl-9"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        <FilterField label="Directory Scope">
                            <div className="text-sm text-zinc-700">
                                Organization-level roles, building-scoped staff, and resident-linked accounts in one directory.
                            </div>
                        </FilterField>
                        <FilterField label="Search Coverage">
                            <div className="text-sm text-zinc-700">Name, email, phone, primary access, detailed roles, and scope labels.</div>
                        </FilterField>
                        <FilterField label="Current View">
                            <div className="text-sm text-zinc-700">
                                {activeTabLabel}
                                {activeTab === "management_staff" ? ` · ${activeStaffFilterLabel}` : ""}
                            </div>
                        </FilterField>
                    </div>

                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UserDirectoryTab)} className="gap-4">
                        <TabsList className="h-auto flex-wrap rounded-2xl bg-zinc-100 p-1">
                            <TabsTrigger value="management_staff" className="gap-2 rounded-xl px-3 py-2">
                                Management &amp; Staff
                                <Badge variant="secondary" className="bg-white text-zinc-700">
                                    {filteredDirectoryCounts.management_staff}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="residents" className="gap-2 rounded-xl px-3 py-2">
                                Residents
                                <Badge variant="secondary" className="bg-white text-zinc-700">
                                    {filteredDirectoryCounts.residents}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="pending_setup" className="gap-2 rounded-xl px-3 py-2">
                                Pending Setup
                                <Badge variant="secondary" className="bg-white text-zinc-700">
                                    {filteredDirectoryCounts.pending_setup}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="inactive" className="gap-2 rounded-xl px-3 py-2">
                                Inactive
                                <Badge variant="secondary" className="bg-white text-zinc-700">
                                    {filteredDirectoryCounts.inactive}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {activeTab === "management_staff" ? (
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: "all", label: "All", count: filteredDirectoryCounts.staffFilters.all },
                                { key: "org_wide", label: "Org-wide", count: filteredDirectoryCounts.staffFilters.org_wide },
                                { key: "building_scoped", label: "Building-scoped", count: filteredDirectoryCounts.staffFilters.building_scoped },
                                { key: "mixed", label: "Mixed", count: filteredDirectoryCounts.staffFilters.mixed },
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

                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            View
                            <span className="font-medium text-zinc-900">{activeTabLabel}</span>
                        </span>
                        {activeTab === "management_staff" ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                                Staff filter
                                <span className="font-medium text-zinc-900">{activeStaffFilterLabel}</span>
                            </span>
                        ) : null}
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                            Accessible buildings
                            <span className="font-medium text-zinc-900">{buildingOptions.length}</span>
                        </span>
                        {deferredSearch.trim() ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700">
                                Search
                                <span className="font-medium text-zinc-900">{deferredSearch.trim()}</span>
                            </span>
                        ) : null}
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing
                            <span>{visibleUsers.length} user{visibleUsers.length === 1 ? "" : "s"}</span>
                        </span>
                    </div>

                    <div>{renderDirectoryTable(visibleUsers, emptyMessage)}</div>
                </div>
            </section>

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
