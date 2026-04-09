"use client";

import { type ReactNode, useDeferredValue, useEffect, useState } from "react";
import { Building2, ClipboardList, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { requestQueueLabels } from "@/components/requests/requestDisplay";
import { RequestsGrid } from "@/components/requests/RequestsGrid";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsViewToggle } from "@/components/requests/RequestsViewToggle";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { useAccessibleBuildings, useAdminRequests } from "@/lib/queries";
import { getPrimaryManagementQueue, isClosedManagementRequest } from "@/lib/requestQueueManagement";
import { RequestPriority, RequestQueue, ServiceRequest } from "@/lib/types";

type RequestFilterValue = "ALL" | RequestQueue | "ARCHIVE";
type PriorityFilterValue = "ALL" | RequestPriority | "EMERGENCY";

const primaryStatusFilters: RequestFilterValue[] = [
    "ALL",
    "ASSIGNED",
    "ARCHIVE",
    "AWAITING_ESTIMATE",
    "AWAITING_OWNER",
    "OVERDUE",
];

const groupedStatusFilters: RequestFilterValue[] = [
    "READY_TO_ASSIGN",
    "NEEDS_ESTIMATE",
    "IN_PROGRESS",
];

const priorityFilterOptions: PriorityFilterValue[] = [
    "ALL",
    "EMERGENCY",
    "urgent",
    "high",
    "medium",
    "low",
];

const statusFilterLabels: Record<RequestFilterValue, string> = {
    ALL: "All Requests",
    NEW: "New",
    READY_TO_ASSIGN: "Ready to Assign",
    NEEDS_ESTIMATE: "Needs Estimate",
    AWAITING_ESTIMATE: "Awaiting Estimate",
    AWAITING_OWNER: "Awaiting Owner",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    OVERDUE: "Overdue",
    ARCHIVE: "Completed",
};

const priorityFilterLabels: Record<PriorityFilterValue, string> = {
    ALL: "Any Priority",
    EMERGENCY: "Emergency Only",
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
};

const getRequestSearchHaystack = (request: ServiceRequest, buildingNameById: Record<string, string>) => [
    request.title,
    request.description,
    request.unit?.label,
    request.unit?.number,
    typeof request.unit?.floor === "number" ? `floor ${request.unit.floor}` : null,
    request.assignedTo?.fullName,
    request.assignedTo?.email,
    request.serviceProvider?.name,
    request.serviceProviderAssignedTo?.name,
    request.serviceProviderAssignedTo?.email,
    request.createdBy?.name,
    request.createdBy?.fullName,
    request.createdBy?.email,
    request.buildingName,
    buildingNameById[request.buildingId],
]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

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
    const [statusFilter, setStatusFilter] = useState<RequestFilterValue>("ALL");
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>("ALL");
    const [searchValue, setSearchValue] = useState("");
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");
    const deferredSearchValue = useDeferredValue(searchValue);
    const { data: allRequests, isLoading: isAllRequestsLoading } = useAdminRequests(selectedBuildingIds, {
        enabled: canReadRequests && selectedBuildingIds.length > 0,
    });
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

    const archiveCount = (allRequests ?? []).filter((request) => request.status === "completed" || request.status === "cancelled").length;
    const buildingNameById = (buildings || []).reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {});

    const getFilterCount = (filter: RequestFilterValue) => {
        if (filter === "ALL") return allRequests?.length ?? 0;
        if (filter === "ARCHIVE") return archiveCount;
        if (filter === "OVERDUE") return queueCounts.OVERDUE;
        return queueCounts[filter];
    };

    const normalizedSearch = deferredSearchValue.trim().toLowerCase();
    const requests = [...(allRequests ?? [])]
        .filter((request) => {
            if (statusFilter === "ALL") return true;
            if (statusFilter === "ARCHIVE") return isClosedManagementRequest(request);
            if (statusFilter === "OVERDUE") return !isClosedManagementRequest(request) && request.queue === "OVERDUE";
            if (isClosedManagementRequest(request)) return false;
            return getPrimaryManagementQueue(request) === statusFilter;
        })
        .filter((request) => {
            if (priorityFilter === "ALL") return true;
            if (priorityFilter === "EMERGENCY") return Boolean(request.policy?.isEmergency || request.isEmergency);
            return request.priority === priorityFilter;
        })
        .filter((request) => {
            if (!normalizedSearch) return true;
            return getRequestSearchHaystack(request, buildingNameById).includes(normalizedSearch);
        })
        .sort((left, right) => {
            const leftDate = left.completedAt ?? left.updatedAt ?? left.createdAt;
            const rightDate = right.completedAt ?? right.updatedAt ?? right.createdAt;
            return new Date(rightDate).getTime() - new Date(leftDate).getTime();
        });

    useEffect(() => {
        if (!selectedRequest) return;
        if (!requests.some((request) => request.id === selectedRequest.id)) {
            setSelectedRequest(null);
        }
    }, [requests, selectedRequest]);

    const canSwitchBuildings = (buildings?.length ?? 0) > 1;
    const buildingSelectValue = selectedBuildingId ?? buildings?.[0]?.id ?? "";
    const activeBuildingName = buildings?.find((building) => building.id === buildingSelectValue)?.name ?? buildings?.[0]?.name;
    const visibleOtherStatuses = groupedStatusFilters.filter((filter) => getFilterCount(filter) > 0 || statusFilter === filter);
    const secondaryStatuses = visibleOtherStatuses.length > 0 ? visibleOtherStatuses : groupedStatusFilters;
    const selectedStatusLabel = `${statusFilterLabels[statusFilter]} (${getFilterCount(statusFilter)})`;
    const selectedPriorityLabel = priorityFilterLabels[priorityFilter];

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
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Service Requests</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                            Track and resolve maintenance requests across your accessible buildings with one scalable queue.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {(buildings?.length ?? 0) > 0 ? (
                            <div className="rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-[190px]">
                                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Building</div>
                                        {canSwitchBuildings ? (
                                            <Select
                                                value={buildingSelectValue}
                                                onValueChange={(value) => setSelectedBuildingId(value)}
                                            >
                                                <SelectTrigger className="h-auto w-full border-none bg-transparent p-0 text-left text-sm font-semibold text-zinc-900 shadow-none focus:ring-0">
                                                    <SelectValue placeholder={activeBuildingName ?? "Select building"} />
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
                                            <div className="text-sm font-semibold text-zinc-900">{activeBuildingName ?? "No building"}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        <RequestsViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-950">Filter requests</h2>
                        <p className="mt-1 text-xs text-zinc-400">
                            Keep status as the primary control, then narrow by building, priority, or search.
                        </p>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(0,1.55fr)]">
                        <FilterField label="Building">
                            <Select
                                value={buildingSelectValue}
                                onValueChange={(value) => setSelectedBuildingId(value)}
                            >
                                <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                    <SelectValue placeholder={activeBuildingName ?? "Select building"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {buildings?.map((building) => (
                                        <SelectItem key={building.id} value={building.id}>
                                            {building.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>

                        <FilterField label="Status">
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RequestFilterValue)}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900 shadow-none">
                                    <SelectValue placeholder={selectedStatusLabel} />
                                </SelectTrigger>
                                <SelectContent className="w-[280px]">
                                    <SelectGroup>
                                        {primaryStatusFilters.map((filter) => (
                                            <SelectItem key={filter} value={filter}>
                                                {statusFilterLabels[filter]} ({getFilterCount(filter)})
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel>Other statuses</SelectLabel>
                                        {secondaryStatuses.map((filter) => (
                                            <SelectItem key={filter} value={filter}>
                                                {statusFilterLabels[filter]} ({getFilterCount(filter)})
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </FilterField>

                        <FilterField label="Priority">
                            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilterValue)}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                    <SelectValue placeholder={selectedPriorityLabel} />
                                </SelectTrigger>
                                <SelectContent>
                                    {priorityFilterOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {priorityFilterLabels[option]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FilterField>

                        <FilterField label="Search">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="Search requests, locations, staff..."
                                    className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-10 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                />
                            </div>
                        </FilterField>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-zinc-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                            <span className="text-zinc-400">Summary</span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                <span className="text-zinc-500">Total</span>
                                <span className="font-semibold text-zinc-950">{allRequests?.length ?? 0}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5">
                                <span className="text-violet-600">Assigned</span>
                                <span className="font-semibold text-violet-950">{queueCounts.ASSIGNED}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                <span className="text-emerald-700">Completed</span>
                                <span className="font-semibold text-emerald-950">{archiveCount}</span>
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                {statusFilterLabels[statusFilter]}
                            </span>
                            {priorityFilter !== "ALL" ? (
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                    {priorityFilterLabels[priorityFilter]}
                                </span>
                            ) : null}
                            {normalizedSearch ? (
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                    Search: {deferredSearchValue.trim()}
                                </span>
                            ) : null}
                            <span className="rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                                Showing {requests.length} request{requests.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                {viewMode === "table" ? (
                    <RequestsTable
                        requests={requests}
                        isLoading={isLoading}
                        onSelect={setSelectedRequest}
                        buildingNameById={buildingNameById}
                        showBuilding={false}
                    />
                ) : (
                    <RequestsGrid
                        requests={requests}
                        isLoading={isLoading}
                        onSelect={setSelectedRequest}
                        buildingNameById={buildingNameById}
                        showBuilding={false}
                    />
                )}
            </section>

            <RequestDetailSheet
                requestId={selectedRequest?.id ?? null}
                buildingId={selectedRequest?.buildingId ?? null}
                buildingNameById={buildingNameById}
                onClose={() => setSelectedRequest(null)}
            />
        </div>
    );
}
