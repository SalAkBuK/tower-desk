"use client";

import { useEffect, useState } from "react";
import { Building2, ClipboardList, ShieldAlert, Timer, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { RequestsGrid } from "@/components/requests/RequestsGrid";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsViewToggle } from "@/components/requests/RequestsViewToggle";
import { useAccessibleBuildings, useAdminRequests } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { getPrimaryManagementQueue, isClosedManagementRequest } from "@/lib/requestQueueManagement";
import { RequestQueue, ServiceRequest } from "@/lib/types";
import { requestQueueLabels, requestQueueStyles } from "@/components/requests/requestDisplay";

const queueTabs: RequestQueue[] = [
    "READY_TO_ASSIGN",
    "NEEDS_ESTIMATE",
    "AWAITING_ESTIMATE",
    "AWAITING_OWNER",
    "ASSIGNED",
    "IN_PROGRESS",
];

type SecondaryView = "ACTIVE" | "OVERDUE" | "ARCHIVE";

export function RequestsPage() {
    const { user, baseRole, login, token, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const searchParams = useSearchParams();
    const userId = user?.id;
    const permissionSet = getUserPermissionSet(user);
    const requestsModuleRule = getPortalModuleByKey("requests")?.rule;
    const canReadRequests = Boolean(requestsModuleRule && hasAnyPermission(permissionSet, requestsModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(userId, baseRole, { enabled: canReadRequests });
    const buildings = accessibleBuildingsQuery.data;
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = buildings?.map((building) => building.id) || [];
    const selectedBuildingIds = selectedBuildingId && buildingIds.includes(selectedBuildingId)
        ? [selectedBuildingId]
        : buildingIds;
    const [activeQueue, setActiveQueue] = useState<RequestQueue>("READY_TO_ASSIGN");
    const [secondaryView, setSecondaryView] = useState<SecondaryView>("ACTIVE");
    const { data: allRequests, isLoading: isAllRequestsLoading } = useAdminRequests(selectedBuildingIds, {
        enabled: canReadRequests && selectedBuildingIds.length > 0,
    });
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");
    const isLoading = isBuildingsLoading || isAllRequestsLoading;

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

    const queueCounts = (allRequests || []).reduce<Record<RequestQueue, number>>((acc, request) => {
        if (isClosedManagementRequest(request)) return acc;
        const primaryQueue = getPrimaryManagementQueue(request);
        if (primaryQueue in acc && primaryQueue !== "NEW" && primaryQueue !== "OVERDUE") {
            acc[primaryQueue] += 1;
        }
        if (request.queue === "OVERDUE") {
            acc.OVERDUE += 1;
        }
        return acc;
    }, {
        NEW: 0,
        NEEDS_ESTIMATE: 0,
        AWAITING_ESTIMATE: 0,
        AWAITING_OWNER: 0,
        READY_TO_ASSIGN: 0,
        ASSIGNED: 0,
        IN_PROGRESS: 0,
        OVERDUE: 0,
    });
    const totalRequests = allRequests?.length ?? 0;
    const archiveCount = (allRequests ?? []).filter((request) => request.status === "completed" || request.status === "cancelled").length;
    const requests = (allRequests ?? []).filter((request) => {
        if (secondaryView === "OVERDUE") return !isClosedManagementRequest(request) && request.queue === "OVERDUE";
        if (secondaryView === "ARCHIVE") return isClosedManagementRequest(request);
        if (isClosedManagementRequest(request)) return false;
        return getPrimaryManagementQueue(request) === activeQueue;
    });

    useEffect(() => {
        if (!selectedRequest) return;
        if (!requests.some((request) => request.id === selectedRequest.id)) {
            setSelectedRequest(null);
        }
    }, [requests, selectedRequest]);

    const buildingNameById = (buildings || []).reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {});

    const canSwitchBuildings = (buildings?.length ?? 0) > 1;
    const activeBuildingName = buildings?.find((building) => building.id === selectedBuildingId)?.name ?? buildings?.[0]?.name;

    if (!canReadRequests) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900">Service Requests</h1>
                        <p className="text-sm text-zinc-500">You do not have permission to view service requests.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Service Requests</h1>
                        <p className="mt-1 text-sm text-zinc-500">Track, prioritize, and resolve maintenance across your accessible buildings.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {(buildings?.length ?? 0) > 0 ? (
                            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                                    <Building2 className="h-4 w-4 text-zinc-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">Building</span>
                                    {canSwitchBuildings ? (
                                        <Select value={selectedBuildingId || ""} onValueChange={(value) => setSelectedBuildingId(value || null)}>
                                            <SelectTrigger className="h-auto w-[200px] border-none p-0 text-sm font-medium text-zinc-800 shadow-none focus:ring-0">
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
                                    ) : (
                                        <span className="text-sm font-medium text-zinc-800">{activeBuildingName ?? "No building"}</span>
                                    )}
                                </div>
                            </div>
                        ) : null}
                        <RequestsViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                        { label: "Total Requests", value: totalRequests, icon: ClipboardList, color: "bg-blue-50 text-blue-700" },
                        { label: "Needs Estimate", value: queueCounts.NEEDS_ESTIMATE, icon: ClipboardList, color: "bg-cyan-50 text-cyan-700" },
                        { label: "Awaiting Estimate", value: queueCounts.AWAITING_ESTIMATE, icon: Timer, color: "bg-teal-50 text-teal-700" },
                        { label: "Awaiting Owner", value: queueCounts.AWAITING_OWNER, icon: ShieldAlert, color: "bg-amber-50 text-amber-700" },
                        { label: "Ready To Assign", value: queueCounts.READY_TO_ASSIGN, icon: Wrench, color: "bg-sky-50 text-sky-700" },
                        { label: "Overdue", value: queueCounts.OVERDUE, icon: Timer, color: "bg-rose-50 text-rose-700" },
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
                <Tabs value={activeQueue} onValueChange={(value) => setActiveQueue(value as RequestQueue)} className="w-full">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900">Request Queue</h2>
                            <p className="text-xs text-zinc-400">Primary tabs reflect the next management action. Overdue and closed-history stay available as secondary views.</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Select value={secondaryView} onValueChange={(value) => setSecondaryView(value as SecondaryView)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active queues</SelectItem>
                                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                                    <SelectItem value="ARCHIVE">Archive</SelectItem>
                                </SelectContent>
                            </Select>
                            <TabsList className="h-auto flex-wrap rounded-lg bg-zinc-100 p-1">
                                {queueTabs.map((queue) => (
                                    <TabsTrigger key={queue} value={queue} className="gap-2">
                                        <span>{requestQueueLabels[queue]}</span>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${requestQueueStyles[queue]}`}>
                                            {queueCounts[queue]}
                                        </span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        {secondaryView === "ACTIVE" ? (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                                Queue: {requestQueueLabels[activeQueue]}
                            </span>
                        ) : null}
                        {secondaryView === "OVERDUE" ? (
                            <>
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                                    Overdue: {queueCounts.OVERDUE}
                                </span>
                                <span>Secondary alert view for SLA-risk work.</span>
                            </>
                        ) : null}
                        {secondaryView === "ARCHIVE" ? (
                            <>
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                                    Archive: {archiveCount}
                                </span>
                                <span>Closed-history access for completed and canceled requests.</span>
                            </>
                        ) : null}
                    </div>

                    <div className="mt-6 space-y-4">
                        {viewMode === "table" ? (
                            <RequestsTable
                                requests={requests}
                                isLoading={isLoading}
                                onSelect={setSelectedRequest}
                                buildingNameById={buildingNameById}
                            />
                        ) : (
                            <RequestsGrid
                                requests={requests}
                                isLoading={isLoading}
                                onSelect={setSelectedRequest}
                                buildingNameById={buildingNameById}
                            />
                        )}
                    </div>
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
