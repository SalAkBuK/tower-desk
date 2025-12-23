"use client";

import { useBuilding, useRequests, useUsers } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin, Users, Wrench, ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function BuildingDetailsPage() {
    const params = useParams();
    const buildingId = params.buildingId as string;
    const { data: building, isLoading: buildingLoading } = useBuilding(buildingId);
    const { data: requests } = useRequests(buildingId);
    const { data: users } = useUsers();

    const assignedManagers = users?.filter(u => u.role === 'manager' && u.buildingIds.includes(buildingId)) || [];

    if (buildingLoading) {
        return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!building) {
        return <div>Building not found</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/sa/buildings">
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
                <div className="ml-auto">
                    <Button variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Occupancy</CardTitle>
                        <Users className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{(building.stats?.occupancyRate || 0) * 100}%</div>
                        <p className="text-xs text-zinc-500 mt-1">{building.stats?.totalTenants} total tenants</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Active Requests</CardTitle>
                        <Wrench className="w-4 h-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-zinc-900">{building.stats?.activeRequests || 0}</div>
                        <p className="text-xs text-zinc-500 mt-1">Total pending maintenance</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Managers</CardTitle>
                        <Building2 className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center -space-x-2 mt-1">
                            {assignedManagers.map(m => (
                                <Avatar key={m.id} className="border-2 border-white w-8 h-8">
                                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                                        {m.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {assignedManagers.length === 0 && <span className="text-zinc-400 text-sm">No managers assigned</span>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Latest Requests Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Recent Requests</CardTitle>
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
        </div>
    );
}
