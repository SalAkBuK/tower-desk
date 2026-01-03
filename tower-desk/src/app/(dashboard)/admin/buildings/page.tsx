"use client";

import { useAdminBuildings, useAdminRequests, useAdminUsers } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Users, Activity, Plus, Layers } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { useEffect, useState } from "react";
import { formatBuildingLocation } from "@/lib/utils";

export default function AdminBuildingsPage() {
    const { user, login, token } = useAuth();
    const adminId = user?.id;
    const { data: buildings, isLoading } = useAdminBuildings(adminId);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const { data: requests } = useAdminRequests(buildingIds);
    const { data: users } = useAdminUsers(buildingIds);

    const myBuildings = buildings || [];

    // Aggregations
    const activeRequestsByBuilding = (requests || []).reduce<Record<string, number>>((acc, req) => {
        if (req.status !== 'completed' && req.status !== 'cancelled') {
            acc[req.buildingId] = (acc[req.buildingId] || 0) + 1;
        }
        return acc;
    }, {});

    const usersByBuilding = (users || []).reduce<Record<string, { tenants: number; staff: number; managers: number }>>((acc, user) => {
        user.buildingIds.forEach((bid) => {
            if (!acc[bid]) acc[bid] = { tenants: 0, staff: 0, managers: 0 };
            if (user.role === 'tenant') acc[bid].tenants++;
            if (user.role === 'employee') acc[bid].staff++;
            if (user.role === 'manager') acc[bid].managers++;
        });
        return acc;
    }, {});

    // Session Sync Logic
    useEffect(() => {
        if (!user || !buildings) return;
        const nextIds = buildings.map((building) => building.id);
        const currentIds = user.buildingIds || [];
        // Check if arrays are same content
        const sameLength = nextIds.length === currentIds.length;
        const hasAll = nextIds.every((id) => currentIds.includes(id));

        if (sameLength && hasAll) return;

        // Update session if buildings changed
        login({ ...user, buildingIds: nextIds }, token);
    }, [buildings, user, login, token]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">My Buildings</h1>
                    <p className="text-zinc-500 mt-2 text-base max-w-2xl">
                        Overview of properties under your administration.
                    </p>
                </div>
                <Button
                    size="lg"
                    className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
                    onClick={() => setIsCreateOpen(true)}
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Building
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myBuildings.length > 0 ? (
                        myBuildings.map((building) => {
                            const stats = usersByBuilding[building.id] || { tenants: 0, staff: 0, managers: 0 };
                            const activeIssues = activeRequestsByBuilding[building.id] || 0;

                            return (
                                <Link
                                    key={building.id}
                                    href={`/admin/buildings/${building.id}`}
                                    className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="rounded-xl bg-zinc-100 p-3 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={building.status === 'active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-zinc-100 text-zinc-600'}
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

                                    <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4">
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
                            <p className="text-zinc-500 mt-1 max-w-sm mx-auto">Create your first building to get started.</p>
                            <Button
                                variant="outline"
                                className="mt-6"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Building
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <CreateBuildingSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                assignToAdminId={user?.id}
                onAssigned={(buildingId) => {
                    // Force update session logic handled by useEffect, but we can optimistically update if needed
                    // The useEffect will catch the new building from useAdminBuildings hook which refetches on Create
                }}
            />
        </div>
    );
}
