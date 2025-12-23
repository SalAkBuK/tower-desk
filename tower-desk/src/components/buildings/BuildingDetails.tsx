"use client";

import { useAdminUsers, useBuilding, useRequests } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin, Users, ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";

interface BuildingDetailsProps {
    buildingId: string;
    backHref: string;
    showAddTenant?: boolean;
}

export function BuildingDetails({ buildingId, backHref, showAddTenant = true }: BuildingDetailsProps) {
    const { data: building, isLoading: buildingLoading } = useBuilding(buildingId);
    const { data: requests } = useRequests(buildingId);
    const { data: users } = useAdminUsers([buildingId]);
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const requestsHref = backHref.replace('/buildings', '/requests');

    const assignedManagers = users?.filter(u => u.role === 'manager' && u.buildingIds.includes(buildingId)) || [];
    const assignedMaintenanceStaff = users?.filter(u => u.role === 'employee' && u.buildingIds.includes(buildingId)) || [];
    const assignedTenants = users?.filter(u => u.role === 'tenant' && u.buildingIds.includes(buildingId)) || [];

    const renderNameList = (names: string[], emptyLabel: string) => {
        if (names.length === 0) {
            return <p className="text-xs text-zinc-400 mt-2">{emptyLabel}</p>;
        }
        return (
            <div className="flex flex-wrap gap-2 mt-3">
                {names.map((name, index) => (
                    <Badge key={`${name}-${index}`} variant="secondary" className="bg-zinc-100 text-zinc-700">
                        {name}
                    </Badge>
                ))}
            </div>
        );
    };

    if (buildingLoading) {
        return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!building) {
        return <div>Building not found</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link href={backHref}>
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-100 rounded-full">
                            <ArrowLeft className="w-5 h-5 text-zinc-500" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
                            {building.name}
                            <Badge variant="outline" className={building.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}>
                                {building.status}
                            </Badge>
                        </h1>
                        <div className="flex items-center text-zinc-500 mt-1">
                            <MapPin className="w-4 h-4 mr-1" />
                            {building.address}
                        </div>
                    </div>
                </div>
                {showAddTenant ? (
                    <Button onClick={() => setIsAddTenantOpen(true)} className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Add Tenant
                    </Button>
                ) : null}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Occupancy</CardTitle>
                        <Users className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedTenants.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Total tenants assigned</p>
                        {renderNameList(assignedTenants.map((u) => u.name), "No tenants assigned")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Staff</CardTitle>
                        <Users className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedMaintenanceStaff.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Maintenance staff assigned</p>
                        {renderNameList(assignedMaintenanceStaff.map((u) => u.name), "No maintenance staff assigned")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Managers</CardTitle>
                        <Building2 className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{assignedManagers.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Managers assigned</p>
                        {renderNameList(assignedManagers.map((u) => u.name), "No managers assigned")}
                    </CardContent>
                </Card>
            </div>

            {/* Latest Requests Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Building Requests</CardTitle>
                        <Link href={`${requestsHref}?buildingId=${buildingId}`}>
                            <Button variant="link" className="text-xs">View All</Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {requests?.slice(0, 5).map(req => (
                                <div key={req.id} className="flex items-center justify-between border-b border-zinc-50 last:border-0 pb-3 last:pb-0">
                                    <div>
                                        <p className="font-medium text-zinc-900">{req.title}</p>
                                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{req.description}</p>
                                    </div>
                                    <Badge variant={req.priority === 'urgent' ? 'destructive' : 'secondary'}>
                                        {req.status}
                                    </Badge>
                                </div>
                            ))}
                            {(!requests || requests.length === 0) && (
                                <p className="text-zinc-500 text-sm">No requests found.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {showAddTenant ? (
                <CreateUserSheet
                    open={isAddTenantOpen}
                    onOpenChange={setIsAddTenantOpen}
                    defaultRole="tenant"
                    lockRole
                    requireBuildingAssignment
                    defaultBuildingId={buildingId}
                    buildingOptions={[{ id: buildingId, name: building.name }]}
                />
            ) : null}
        </div>
    );
}
