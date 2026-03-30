"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Building2, Layers, MapPin, Plus, Users } from "lucide-react";

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
    const buildings = accessibleBuildingsQuery.data ?? [];
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

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                    <p className="text-zinc-500 mt-2 text-base max-w-2xl">{description}</p>
                </div>
                {canCreateBuildings ? (
                    <Button
                        size="lg"
                        className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
                        onClick={() => setIsCreateOpen(true)}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Building
                    </Button>
                ) : null}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {buildings.length > 0 ? (
                        buildings.map((building) => {
                            const stats = usersByBuilding[building.id] || { tenants: 0, staff: 0, managers: 0 };
                            const activeIssues = activeRequestsByBuilding[building.id] || 0;

                            return (
                                <Link
                                    key={building.id}
                                    href={portalPath("buildings", building.id)}
                                    className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="rounded-xl bg-zinc-100 p-3 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={building.status === "active"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : "bg-zinc-100 text-zinc-600"}
                                        >
                                            {building.status}
                                        </Badge>
                                    </div>

                                    <div className="flex-1 mb-6">
                                        <h3 className="text-xl font-bold text-zinc-900 mb-2 truncate group-hover:opacity-80 transition-opacity">
                                            {building.name}
                                        </h3>
                                        <div className="flex items-center text-sm text-zinc-500">
                                            <MapPin className="w-4 h-4 mr-1.5 text-zinc-400" />
                                            <span className="truncate">{formatBuildingLocation(building) || "Location not set"}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 border-t border-zinc-100 pt-4">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                                <Layers className="h-4 w-4 text-zinc-400" />
                                                {building.unitsCount || 0}
                                            </div>
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Units</p>
                                        </div>
                                        <div className="text-center border-l border-zinc-100">
                                            <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                                <Users className="h-4 w-4 text-zinc-400" />
                                                {stats.tenants}
                                            </div>
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Tenants</p>
                                        </div>
                                        <div className="text-center border-l border-zinc-100">
                                            <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                                <Users className="h-4 w-4 text-blue-400" />
                                                {stats.staff}
                                            </div>
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Staff</p>
                                        </div>
                                        <div className="text-center border-l border-zinc-100">
                                            <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-semibold">
                                                <Activity className="h-4 w-4 text-orange-500" />
                                                {activeIssues}
                                            </div>
                                            <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400 mt-1">Issues</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
                            <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-zinc-900">No buildings found</h3>
                            <p className="text-zinc-500 mt-1 max-w-sm mx-auto">
                                {canCreateBuildings
                                    ? "Create your first building to get started."
                                    : "No building is currently assigned to your account."}
                            </p>
                            {canCreateBuildings ? (
                                <Button
                                    variant="outline"
                                    className="mt-6"
                                    onClick={() => setIsCreateOpen(true)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
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
