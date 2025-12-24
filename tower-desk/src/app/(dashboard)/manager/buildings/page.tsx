"use client";

import { useAdminRequests, useAdminUsers, useManagerBuildings } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Users, Activity } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export default function ManagerBuildingsPage() {
    const { user, login, token } = useAuth();
    const managerId = user?.id;
    const { data: buildings, isLoading } = useManagerBuildings(managerId);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const { data: requests } = useAdminRequests(buildingIds);
    const { data: users } = useAdminUsers(buildingIds);

    const myBuildings = buildings || [];
    const activeRequestsByBuilding = (requests || []).reduce<Record<string, number>>((acc, req) => {
        if (req.status !== 'completed') {
            acc[req.buildingId] = (acc[req.buildingId] || 0) + 1;
        }
        return acc;
    }, {});
    const usersByBuilding = (users || []).reduce<Record<string, { tenants: string[]; staff: string[]; managers: string[] }>>((acc, user) => {
        user.buildingIds.forEach((bid) => {
            if (!acc[bid]) acc[bid] = { tenants: [], staff: [], managers: [] };
            if (user.role === 'tenant') acc[bid].tenants.push(user.name);
            if (user.role === 'employee') acc[bid].staff.push(user.name);
            if (user.role === 'manager') acc[bid].managers.push(user.name);
        });
        return acc;
    }, {});

    const renderCompactNames = (names: string[], max = 2) => {
        if (names.length === 0) {
            return <div className="text-[11px] text-zinc-400 mt-1">None</div>;
        }
        const visible = names.slice(0, max);
        const remaining = names.length - visible.length;
        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {visible.map((name, index) => (
                    <Badge key={`${name}-${index}`} variant="secondary" className="bg-zinc-100 text-zinc-700 text-[10px]">
                        {name.split(" ")[0] || name}
                    </Badge>
                ))}
                {remaining > 0 && (
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 text-[10px]">
                        +{remaining}
                    </Badge>
                )}
            </div>
        );
    };

    useEffect(() => {
        if (!user || !buildings) return;
        const nextIds = buildings.map((building) => building.id);
        const currentIds = user.buildingIds || [];
        const sameLength = nextIds.length === currentIds.length;
        const hasAll = nextIds.every((id) => currentIds.includes(id));
        if (sameLength && hasAll) return;
        login({ ...user, buildingIds: nextIds }, token);
    }, [buildings, user, login, token]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">My Building</h1>
                <p className="text-zinc-500 mt-1">Property assigned to your account.</p>
            </div>

            <div className="space-y-3">
                {myBuildings.length > 0 ? (
                    myBuildings.map((building) => {
                        const buildingUsers = usersByBuilding[building.id] || { tenants: [], staff: [], managers: [] };
                        return (
                            <Link key={building.id} href={`/manager/buildings/${building.id}`}>
                                <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-md hover:border-zinc-300 transition-all duration-200 cursor-pointer group">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left Section - Building Info */}
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className="bg-zinc-100 p-3 rounded-lg group-hover:bg-primary/10 transition-colors shrink-0">
                                                <Building2 className="w-5 h-5 text-zinc-600 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-primary transition-colors">
                                                        {building.name}
                                                    </h3>
                                                    <Badge
                                                        variant={building.status === 'active' ? 'default' : 'secondary'}
                                                        className={building.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                                    >
                                                        {building.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center text-sm text-zinc-500">
                                                    <MapPin className="w-4 h-4 mr-1.5 shrink-0" />
                                                    <span className="truncate">{building.address}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Section - Stats */}
                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="text-center">
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Tenants</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Users className="w-4 h-4 text-zinc-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.tenants.length}</span>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Staff</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Users className="w-4 h-4 text-blue-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.staff.length}</span>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Managers</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Users className="w-4 h-4 text-purple-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.managers.length}</span>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Active Requests</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Activity className="w-4 h-4 text-orange-400" />
                                                    <span className="font-semibold text-zinc-700">{activeRequestsByBuilding[building.id] || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div className="py-12 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                        <p className="text-zinc-500">No building assigned to your account.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
