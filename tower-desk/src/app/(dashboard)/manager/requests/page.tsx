"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, ClipboardList, Timer } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { RequestsGrid } from "@/components/requests/RequestsGrid";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsViewToggle } from "@/components/requests/RequestsViewToggle";
import { useManagerBuildings, useAdminRequests } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { RequestStatus, ServiceRequest } from "@/lib/types";

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
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");
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

    const statusCounts = (requests || []).reduce<Record<RequestStatus, number>>((acc, request) => {
        acc[request.status] += 1;
        return acc;
    }, {
        pending: 0,
        assigned: 0,
        "in-progress": 0,
        "on-hold": 0,
        completed: 0,
        cancelled: 0,
    });
    const totalRequests = requests?.length ?? 0;

    const buildingNameById = (buildings || []).reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Service Requests</h1>
                        <p className="mt-1 text-sm text-zinc-500">Keep tenant issues moving with clear status ownership.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {buildings && buildings.length > 0 ? (
                            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                                    <Building2 className="h-4 w-4 text-zinc-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">Building</span>
                                    <span className="text-sm font-medium text-zinc-800">{buildings[0].name}</span>
                                </div>
                            </div>
                        ) : null}
                        <RequestsViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "Total Requests", value: totalRequests, icon: ClipboardList, color: "bg-blue-50 text-blue-700" },
                        { label: "Open", value: statusCounts.pending, icon: AlertCircle, color: "bg-amber-50 text-amber-700" },
                        { label: "In Progress", value: statusCounts["in-progress"], icon: Timer, color: "bg-orange-50 text-orange-700" },
                        { label: "Completed", value: statusCounts.completed, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
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
                <Tabs defaultValue="all" className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Request Queue</h2>
                            <p className="text-xs text-zinc-400">Filter by status to keep the backlog focused.</p>
                        </div>
                        <TabsList className="rounded-lg bg-zinc-100 p-1">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Open</TabsTrigger>
                            <TabsTrigger value="assigned">Assigned</TabsTrigger>
                            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                            <TabsTrigger value="cancelled">Canceled</TabsTrigger>
                        </TabsList>
                    </div>

                    {['all', 'pending', 'assigned', 'in-progress', 'completed', 'cancelled'].map((tab) => {
                        const filteredRequests = filterRequests(tab as RequestStatus | 'all');
                        return (
                            <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                                {viewMode === "table" ? (
                                    <RequestsTable
                                        requests={filteredRequests}
                                        isLoading={isLoading}
                                        onSelect={setSelectedRequest}
                                        buildingNameById={buildingNameById}
                                    />
                                ) : (
                                    <RequestsGrid
                                        requests={filteredRequests}
                                        isLoading={isLoading}
                                        onSelect={setSelectedRequest}
                                        buildingNameById={buildingNameById}
                                    />
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>

            <RequestDetailSheet
                requestId={selectedRequest?.id ?? null}
                buildingId={selectedRequest?.buildingId ?? null}
                buildingNameById={buildingNameById}
                onClose={() => setSelectedRequest(null)}
            />
        </div>
    );
}
