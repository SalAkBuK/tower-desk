"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, Building2, Layers, MapPin, Plus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { useAuth } from "@/lib/auth";
import { useAccessibleBuildings, useAdminRequests, useAdminUsers } from "@/lib/queries";
import { portalPath } from "@/lib/portalPaths";
import { isOrganizationAdminRole } from "@/lib/roles";
import { formatBuildingLocation } from "@/lib/utils";

export function PortalBuildingsPage() {
    const { user, baseRole, login, token } = useAuth();
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole);
    const buildings = useMemo(() => accessibleBuildingsQuery.data ?? [], [accessibleBuildingsQuery.data]);
    const isLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = buildings.map((building) => building.id);
    const canCreateBuildings = baseRole === "superadmin" || isOrganizationAdminRole(baseRole);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const { data: requests } = useAdminRequests(buildingIds);
    const { data: users } = useAdminUsers(buildingIds);

    useEffect(() => {
        if (!user || buildings.length === 0) return;
        const currentIds = user.buildingIds || [];
        const sameLength = buildingIds.length === currentIds.length;
        const hasAll = buildingIds.every((id) => currentIds.includes(id));
        if (sameLength && hasAll) return;
        login({ ...user, buildingIds }, token);
    }, [buildingIds, buildings.length, login, token, user]);

    const activeRequestsByBuilding = useMemo(() => {
        return (requests || []).reduce<Record<string, number>>((acc, req) => {
            if (req.status !== "completed" && req.status !== "cancelled") {
                acc[req.buildingId] = (acc[req.buildingId] || 0) + 1;
            }
            return acc;
        }, {});
    }, [requests]);

    const usersByBuilding = useMemo(() => {
        return (users || []).reduce<Record<string, { tenants: number; staff: number; managers: number }>>((acc, entry) => {
            entry.buildingIds.forEach((buildingId) => {
                if (!acc[buildingId]) acc[buildingId] = { tenants: 0, staff: 0, managers: 0 };
                const role = entry.baseRole ?? entry.role;
                if (role === "tenant") acc[buildingId].tenants += 1;
                if (role === "employee") acc[buildingId].staff += 1;
                if (role === "manager" || role === "building_admin") acc[buildingId].managers += 1;
            });
            return acc;
        }, {});
    }, [users]);

    const title = buildings.length > 1 || canCreateBuildings ? "Buildings" : "My Building";
    const description = canCreateBuildings
        ? "Overview of properties under your accessible scope."
        : "Properties assigned to your account.";
    const portfolioStats = useMemo(() => {
        const totals = buildings.reduce(
            (acc, building) => {
                const stats = usersByBuilding[building.id] || { tenants: 0, staff: 0, managers: 0 };
                acc.units += building.unitsCount || 0;
                acc.tenants += stats.tenants;
                acc.staff += stats.staff;
                acc.issues += activeRequestsByBuilding[building.id] || 0;
                return acc;
            },
            { units: 0, tenants: 0, staff: 0, issues: 0 }
        );

        return [
            {
                label: "Properties",
                value: buildings.length,
                detail: canCreateBuildings ? "Buildings in scope" : "Assigned buildings",
                icon: Building2,
                tone: "bg-zinc-900 text-white",
            },
            {
                label: "Units",
                value: totals.units,
                detail: "Across visible portfolio",
                icon: Layers,
                tone: "bg-zinc-100 text-zinc-700",
            },
            {
                label: "Residents",
                value: totals.tenants,
                detail: "Current tenant assignments",
                icon: Users,
                tone: "bg-emerald-50 text-emerald-700",
            },
            {
                label: "Open Work",
                value: totals.issues,
                detail: "Active service requests",
                icon: Activity,
                tone: "bg-amber-50 text-amber-700",
            },
        ];
    }, [activeRequestsByBuilding, buildings, canCreateBuildings, usersByBuilding]);

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-8">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="border-b border-zinc-100 bg-[radial-gradient(circle_at_top_left,_rgba(5,150,105,0.08),_transparent_34%),linear-gradient(180deg,_rgba(250,250,250,0.95),_#ffffff)] px-6 py-6 md:px-8 md:py-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
                                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                                Portfolio overview
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">{title}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
                                {description} Review building health, occupancy signals, and operational load from one quiet workspace.
                            </p>
                        </div>
                        {canCreateBuildings ? (
                            <Button
                                size="lg"
                                className="h-11 rounded-xl bg-zinc-900 px-5 text-white shadow-sm hover:bg-zinc-800"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Create Building
                            </Button>
                        ) : null}
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {portfolioStats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
                                    <stat.icon className="h-4 w-4" />
                                </div>
                                <div className="mt-4 flex items-end justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{stat.label}</div>
                                        <div className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">{stat.value}</div>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-zinc-500">{stat.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Property Directory</h2>
                    <p className="mt-1 text-sm text-zinc-500">Open a building to manage units, tenants, staffing, and request activity.</p>
                </div>
                <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500">
                    {buildings.length} {buildings.length === 1 ? "building" : "buildings"}
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-72 rounded-[24px]" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {buildings.length > 0 ? (
                        buildings.map((building) => {
                            const stats = usersByBuilding[building.id] || { tenants: 0, staff: 0, managers: 0 };
                            const activeIssues = activeRequestsByBuilding[building.id] || 0;
                            const occupancyTone =
                                activeIssues > 0
                                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";

                            return (
                                <Link
                                    key={building.id}
                                    href={portalPath("buildings", building.id)}
                                    className="group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                                >
                                    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_rgba(24,24,27,0.06),_transparent_60%),radial-gradient(circle_at_top_right,_rgba(5,150,105,0.08),_transparent_40%)] opacity-80" />

                                    <div className="relative mb-6 flex items-start justify-between gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors duration-200 group-hover:border-zinc-300 group-hover:text-zinc-950">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={building.status === "active"
                                                ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                                                : "border border-zinc-200 bg-zinc-100 text-zinc-600"}
                                        >
                                            {building.status}
                                        </Badge>
                                    </div>

                                    <div className="relative mb-6 flex-1">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ${occupancyTone}`}>
                                                <Activity className="h-3.5 w-3.5" />
                                                {activeIssues > 0 ? `${activeIssues} active issues` : "No active issues"}
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-700" />
                                        </div>
                                        <h3 className="mb-2 truncate text-xl font-semibold tracking-tight text-zinc-950 transition-opacity group-hover:opacity-85">
                                            {building.name}
                                        </h3>
                                        <div className="flex items-center text-sm text-zinc-500">
                                            <MapPin className="mr-1.5 h-4 w-4 text-zinc-400" />
                                            <span className="truncate">{formatBuildingLocation(building) || "Location not set"}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-5">
                                        <div className="rounded-2xl bg-zinc-50 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Units</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                                <Layers className="h-4 w-4 text-zinc-400" />
                                                {building.unitsCount || 0}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-zinc-50 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Residents</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                                <Users className="h-4 w-4 text-emerald-600" />
                                                {stats.tenants}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-zinc-50 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Staff</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                                <Users className="h-4 w-4 text-blue-500" />
                                                {stats.staff}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-zinc-50 p-3">
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Managers</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                                <Users className="h-4 w-4 text-zinc-500" />
                                                {stats.managers}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="col-span-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                                <Building2 className="h-6 w-6 text-zinc-300" />
                            </div>
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-900">No buildings found</h3>
                            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                                {canCreateBuildings
                                    ? "Create your first building to get started."
                                    : "No building is currently assigned to your account."}
                            </p>
                            {canCreateBuildings ? (
                                <Button
                                    variant="outline"
                                    className="mt-6 rounded-xl bg-white"
                                    onClick={() => setIsCreateOpen(true)}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Building
                                </Button>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {canCreateBuildings ? (
                <CreateBuildingSheet
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    assignToAdminId={user?.id}
                />
            ) : null}
        </div>
    );
}
