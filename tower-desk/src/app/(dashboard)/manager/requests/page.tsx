"use client";

import { useManagerBuildings, useAdminRequests } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequestPriority, RequestStatus, ServiceRequest } from "@/lib/types";
import { useEffect, useState } from "react";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { ClipboardList, Clock, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ManagerRequestsPage() {
    const { user, login, token, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const searchParams = useSearchParams();
    const managerId = user?.id;
    const { data: buildings, isLoading: isBuildingsLoading } = useManagerBuildings(managerId);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const selectedBuildingIds = selectedBuildingId && buildingIds.includes(selectedBuildingId)
        ? [selectedBuildingId]
        : buildingIds;
    const { data: requests, isLoading: isRequestsLoading } = useAdminRequests(selectedBuildingIds);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const isLoading = isBuildingsLoading || isRequestsLoading;

    useEffect(() => {
        if (!user || !buildings) return;
        const nextIds = buildings.map((building) => building.id);
        const currentIds = user.buildingIds || [];
        const sameLength = nextIds.length === currentIds.length;
        const hasAll = nextIds.every((id) => currentIds.includes(id));
        if (sameLength && hasAll) return;
        login({ ...user, buildingIds: nextIds }, token);
    }, [buildings, user, login, token]);

    useEffect(() => {
        if (!buildings || buildings.length === 0) {
            if (selectedBuildingId) {
                setSelectedBuildingId(null);
            }
            return;
        }
        const paramBuildingId = searchParams.get("buildingId");
        if (paramBuildingId && buildingIds.includes(paramBuildingId)) {
            if (selectedBuildingId !== paramBuildingId) {
                setSelectedBuildingId(paramBuildingId);
            }
            return;
        }
        if (!selectedBuildingId || !buildingIds.includes(selectedBuildingId)) {
            setSelectedBuildingId(buildingIds[0]);
        }
    }, [buildings, buildingIds, selectedBuildingId, setSelectedBuildingId, searchParams]);

    const filterRequests = (status: RequestStatus | 'all') => {
        if (!requests) return [];
        const filtered = status === 'all' ? requests : requests.filter(r => r.status === status);
        return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };

    const groupRequestsByBuilding = (items: ServiceRequest[]) => {
        const grouped = new Map<string, ServiceRequest[]>();
        items.forEach((req) => {
            const key = req.buildingId || 'unknown';
            const list = grouped.get(key) || [];
            list.push(req);
            grouped.set(key, list);
        });

        const orderedIds = selectedBuildingIds.length > 0 ? selectedBuildingIds : (buildings?.map((building) => building.id) || []);
        const result: { id: string; name: string; requests: ServiceRequest[] }[] = [];

        orderedIds.forEach((id) => {
            const list = grouped.get(id);
            if (list && list.length > 0) {
                const name = buildings?.find((building) => building.id === id)?.name || `Building ${id}`;
                result.push({ id, name, requests: list });
                grouped.delete(id);
            }
        });

        grouped.forEach((list, id) => {
            const name = buildings?.find((building) => building.id === id)?.name || `Building ${id}`;
            result.push({ id, name, requests: list });
        });

        return result;
    };

    const getStatusIcon = (status: RequestStatus) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'assigned': return <ClipboardList className="w-4 h-4 text-purple-500" />;
            case 'in-progress': return <AlertCircle className="w-4 h-4 text-blue-500" />;
            case 'on-hold': return <AlertCircle className="w-4 h-4 text-gray-500" />;
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <ClipboardList className="w-4 h-4 text-zinc-400" />;
        }
    };
    const priorityStyles: Record<RequestPriority, string> = {
        low: "bg-emerald-50 text-emerald-700 border-emerald-200",
        medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
        high: "bg-orange-50 text-orange-700 border-orange-200",
        urgent: "bg-red-50 text-red-700 border-red-200"
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Service Requests</h1>
                {buildings && buildings.length > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                        <span className="font-medium text-zinc-800">{buildings[0].name}</span>
                    </div>
                ) : null}
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="bg-zinc-100 p-1 rounded-lg">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">New</TabsTrigger>
                    <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                    <TabsTrigger value="on-hold">On Hold</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                </TabsList>

                {['all', 'pending', 'in-progress', 'on-hold', 'completed', 'cancelled'].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                        {isLoading ? (
                            <div className="text-zinc-500">Loading requests...</div>
                        ) : filterRequests(tab as RequestStatus | 'all').length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-zinc-200">
                                <p className="text-zinc-500">No requests found.</p>
                            </div>
                        ) : (
                            groupRequestsByBuilding(filterRequests(tab as RequestStatus | 'all')).map((group) => (
                                <div key={group.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 uppercase tracking-wide text-[10px]">
                                                Building
                                            </Badge>
                                            <div className="text-sm font-semibold text-zinc-900">{group.name}</div>
                                        </div>
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">
                                            {group.requests.length} requests
                                        </Badge>
                                    </div>
                                    <div className="space-y-3">
                                        {group.requests.map((req) => (
                                            <Card
                                                key={req.id}
                                                className="cursor-pointer hover:shadow-md transition-shadow group border-zinc-200"
                                                onClick={() => setSelectedRequestId(req.id)}
                                            >
                                                <CardHeader className="flex flex-row items-start justify-between pb-2">
                                                    <div className="space-y-1">
                                                        <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                                                            {req.title}
                                                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize ${priorityStyles[req.priority]}`}>
                                                                {req.priority}
                                                            </Badge>
                                                        </CardTitle>
                                                        <p className="text-sm text-zinc-500 line-clamp-1">{req.description}</p>
                                                    </div>
                                                    <Badge variant="outline" className="flex items-center gap-1">
                                                        {getStatusIcon(req.status)}
                                                        <span className="capitalize">{req.status}</span>
                                                    </Badge>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-xs text-zinc-400 flex items-center gap-4">
                                                        <span>ID: {req.id}</span>
                                                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </TabsContent>
                ))}
            </Tabs>

            <RequestDetailSheet
                requestId={selectedRequestId}
                onClose={() => setSelectedRequestId(null)}
            />
        </div>
    );
}
