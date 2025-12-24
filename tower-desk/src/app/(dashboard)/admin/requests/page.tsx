"use client";

import { useAdminBuildings, useAdminRequests } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestStatus } from "@/lib/types"; // Import from types
import { useEffect, useState } from "react";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { RequestsGrid } from "@/components/requests/RequestsGrid";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsViewToggle } from "@/components/requests/RequestsViewToggle";
import { Building2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function RequestsPage() {
    const { user, login, token, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const searchParams = useSearchParams();
    const adminId = user?.id;
    const { data: buildings, isLoading: isBuildingsLoading } = useAdminBuildings(adminId);
    const buildingIds = buildings?.map((building) => building.id) || [];
    const selectedBuildingIds = selectedBuildingId && buildingIds.includes(selectedBuildingId)
        ? [selectedBuildingId]
        : buildingIds;
    const { data: requests, isLoading: isRequestsLoading } = useAdminRequests(selectedBuildingIds);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
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

    const buildingNameById = (buildings || []).reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Service Requests</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                        <Select value={selectedBuildingId || ""} onValueChange={(value) => setSelectedBuildingId(value || null)}>
                            <SelectTrigger className="w-[200px] border-none shadow-none h-auto p-0 focus:ring-0">
                                <SelectValue placeholder="Select building" />
                            </SelectTrigger>
                            <SelectContent>
                                {buildings?.map((building) => (
                                    <SelectItem key={building.id} value={building.id}>
                                        {building.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <RequestsViewToggle value={viewMode} onChange={setViewMode} />
                </div>
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

                {['all', 'pending', 'in-progress', 'on-hold', 'completed', 'cancelled'].map((tab) => {
                    const filteredRequests = filterRequests(tab as RequestStatus | 'all');
                    return (
                        <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                            {viewMode === "table" ? (
                                <RequestsTable
                                    requests={filteredRequests}
                                    isLoading={isLoading}
                                    onSelect={setSelectedRequestId}
                                    buildingNameById={buildingNameById}
                                />
                            ) : (
                                <RequestsGrid
                                    requests={filteredRequests}
                                    isLoading={isLoading}
                                    onSelect={setSelectedRequestId}
                                    buildingNameById={buildingNameById}
                                />
                            )}
                        </TabsContent>
                    );
                })}
            </Tabs>

            <RequestDetailSheet
                requestId={selectedRequestId}
                onClose={() => setSelectedRequestId(null)}
            />
        </div>
    );
}
