"use client";

import { useAdminBuildings, useAdminRequests, useAdminUsers } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Users, Activity, Plus } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBuildingSheet } from "@/components/buildings/CreateBuildingSheet";
import { useEffect, useState } from "react";

export default function AdminBuildingsPage() {
    const { user, login, token } = useAuth();
    const adminId = user?.id;
    const { data: buildings, isLoading } = useAdminBuildings(adminId);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">My Buildings</h1>
                    <p className="text-zinc-500 mt-1">Properties under your administration.</p>
                </div>
                <Button className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Building
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myBuildings.length > 0 ? (
                    myBuildings.map((building) => {
                        const buildingUsers = usersByBuilding[building.id] || { tenants: [], staff: [], managers: [] };
                        return (
                            <Link key={building.id} href={`/admin/buildings/${building.id}`}>
                                <Card className="hover:shadow-lg transition-all duration-300 hover:border-zinc-300 group cursor-pointer h-full">
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start">
                                            <div className="bg-zinc-100 p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                                                <Building2 className="w-6 h-6 text-zinc-600 group-hover:text-primary transition-colors" />
                                            </div>
                                            <Badge variant={building.status === 'active' ? 'default' : 'secondary'} className={building.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                                                {building.status}
                                            </Badge>
                                        </div>
                                        <CardTitle className="mt-4 text-xl">{building.name}</CardTitle>
                                        <div className="flex items-center text-sm text-zinc-500 mt-2">
                                            <MapPin className="w-4 h-4 mr-1 shrink-0" />
                                            <span className="truncate">{building.address}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                                            <div>
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Tenants</p>
                                                <div className="flex items-center mt-1">
                                                    <Users className="w-4 h-4 mr-2 text-zinc-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.tenants.length}</span>
                                                </div>
                                                {renderCompactNames(buildingUsers.tenants)}
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Requests</p>
                                                <div className="flex items-center mt-1">
                                                    <Activity className="w-4 h-4 mr-2 text-orange-400" />
                                                    <span className="font-semibold text-zinc-700">{activeRequestsByBuilding[building.id] || 0} active</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Staff</p>
                                                <div className="flex items-center mt-1">
                                                    <Users className="w-4 h-4 mr-2 text-blue-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.staff.length}</span>
                                                </div>
                                                {renderCompactNames(buildingUsers.staff)}
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Managers</p>
                                                <div className="flex items-center mt-1">
                                                    <Users className="w-4 h-4 mr-2 text-purple-400" />
                                                    <span className="font-semibold text-zinc-700">{buildingUsers.managers.length}</span>
                                                </div>
                                                {renderCompactNames(buildingUsers.managers)}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                        <p className="text-zinc-500">No buildings assigned to your account.</p>
                    </div>
                )}
            </div>

            <CreateBuildingSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                assignToAdminId={user?.id}
                onAssigned={(buildingId) => {
                    if (!user) return;
                    const currentIds = user.buildingIds || [];
                    if (currentIds.includes(buildingId)) return;
                    login({ ...user, buildingIds: [...currentIds, buildingId] }, token);
                }}
            />
        </div>
    );
}
