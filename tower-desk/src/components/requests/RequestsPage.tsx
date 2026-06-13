"use client";

import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ClipboardList, Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import {
    getRequestAssignedStaff,
    getRequestWorkflowBucket,
    workflowBucketLabels,
} from "@/components/requests/requestDisplay";
import type { RequestWorkflowBucket } from "@/components/requests/requestDisplay";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { useAccessibleBuildings, useAdminRequests } from "@/lib/queries";
import { getRequestTenancyBucket, type RequestTenancyBucket } from "@/lib/requestTenancyContext";
import { getPathWithSearchParamUpdates, getPathWithoutSearchParams } from "@/lib/searchParams";
import type { OwnerApprovalStatus, RequestPriority, RequestStatus, ServiceRequest } from "@/lib/types";

type WorkflowFilterValue = RequestWorkflowBucket;
type PriorityFilterValue = "ALL" | RequestPriority | "EMERGENCY";
type AssigneeFilterValue = "ALL" | "UNASSIGNED" | `${"staff" | "provider" | "worker"}:${string}`;
type LifecycleFilterValue = "ALL" | RequestStatus;
type ContextFilterValue = "ALL" | RequestTenancyBucket;
type ApprovalFilterValue = "ALL" | OwnerApprovalStatus;

const ALL_BUILDINGS_VALUE = "__ALL_BUILDINGS__";

const primaryWorkflowFilters: WorkflowFilterValue[] = [
    "ALL_OPEN",
    "OVERDUE",
    "NEEDS_ESTIMATE",
    "AWAITING_OWNER",
    "AWAITING_ESTIMATE",
    "READY_TO_ASSIGN",
];

const secondaryWorkflowFilters: WorkflowFilterValue[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "CLOSED", "HISTORICAL"];

const priorityFilterLabels: Record<PriorityFilterValue, string> = {
    ALL: "Any priority",
    EMERGENCY: "Emergency only",
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
};

const lifecycleFilterLabels: Record<LifecycleFilterValue, string> = {
    ALL: "Any request status",
    pending: "Open",
    assigned: "Assigned",
    "in-progress": "In Progress",
    "on-hold": "On Hold",
    completed: "Completed",
    cancelled: "Canceled",
};

const contextFilterLabels: Record<ContextFilterValue, string> = {
    ALL: "Any request context",
    CURRENT: "Current stay",
    HISTORICAL: "Historical",
    LEGACY: "Legacy",
};

const approvalFilterLabels: Record<ApprovalFilterValue, string> = {
    ALL: "Any approval state",
    NOT_REQUIRED: "Approval not required",
    PENDING: "Awaiting owner",
    APPROVED: "Owner approved",
    REJECTED: "Owner rejected",
};

const getRequestSearchHaystack = (request: ServiceRequest, buildingNameById: Record<string, string>) => {
    const assignedStaff = getRequestAssignedStaff(request);

    return [
        request.id,
        request.title,
        request.description,
        request.unit?.label,
        request.unit?.number,
        typeof request.unit?.floor === "number" ? `floor ${request.unit.floor}` : null,
        assignedStaff?.name,
        assignedStaff?.email,
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
};

const getAssigneeFilterValue = (request: ServiceRequest): AssigneeFilterValue => {
    if (request.serviceProviderAssignedTo?.id) return `worker:${request.serviceProviderAssignedTo.id}`;
    const assignedStaff = getRequestAssignedStaff(request);
    if (assignedStaff?.id) return `staff:${assignedStaff.id}`;
    if (request.serviceProvider?.id) return `provider:${request.serviceProvider.id}`;
    return "UNASSIGNED";
};

const getAssigneeFilterLabel = (request: ServiceRequest) => {
    if (request.serviceProviderAssignedTo) {
        return request.serviceProviderAssignedTo.name ?? request.serviceProviderAssignedTo.email ?? "Assigned worker";
    }
    const assignedStaff = getRequestAssignedStaff(request);
    if (assignedStaff) {
        return assignedStaff.name ?? assignedStaff.email ?? "Assigned staff";
    }
    if (request.serviceProvider) {
        return request.serviceProvider.name ?? "Assigned provider";
    }
    return "Unassigned";
};

const getTimeValue = (value?: string | null) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

function FilterField({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
            {hint ? <p className="mt-1 text-xs leading-5 text-zinc-500">{hint}</p> : null}
            <div className="mt-2">{children}</div>
        </div>
    );
}

export function RequestsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, baseRole, login, token, selectedBuildingId, setSelectedBuildingId } = useAuth();
    const searchParams = useSearchParams();
    const userId = user?.id;
    const permissionSet = getUserPermissionSet(user);
    const requestsModuleRule = getPortalModuleByKey("requests")?.rule;
    const canReadRequests = Boolean(requestsModuleRule && hasAnyPermission(permissionSet, requestsModuleRule));
    const accessibleBuildingsQuery = useAccessibleBuildings(userId, baseRole, { enabled: canReadRequests });
    const buildings = accessibleBuildingsQuery.data;
    const isBuildingsLoading = accessibleBuildingsQuery.isLoading;
    const buildingIds = useMemo(() => buildings?.map((building) => building.id) ?? [], [buildings]);
    const selectedBuildingIds = useMemo(() => (
        selectedBuildingId && buildingIds.includes(selectedBuildingId)
            ? [selectedBuildingId]
            : buildingIds
    ), [buildingIds, selectedBuildingId]);
    const requestedNotificationRequestId = searchParams.get("requestId")?.trim() ?? "";
    const paramBuildingId = searchParams.get("buildingId");
    const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilterValue>("ALL_OPEN");
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>("ALL");
    const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilterValue>("ALL");
    const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilterValue>("ALL");
    const [contextFilter, setContextFilter] = useState<ContextFilterValue>("ALL");
    const [approvalFilter, setApprovalFilter] = useState<ApprovalFilterValue>("ALL");
    const [searchValue, setSearchValue] = useState("");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const handledNotificationRequestIdRef = useRef<string | null>(null);
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

        if (paramBuildingId === ALL_BUILDINGS_VALUE) {
            if (selectedBuildingId !== null) {
                setSelectedBuildingId(null);
            }
            return;
        }

        if (paramBuildingId && buildingIds.includes(paramBuildingId)) {
            if (selectedBuildingId !== paramBuildingId) {
                setSelectedBuildingId(paramBuildingId);
            }
            return;
        }

        if (selectedBuildingId && !buildingIds.includes(selectedBuildingId)) {
            setSelectedBuildingId(null);
        }
    }, [buildings, buildingIds, paramBuildingId, selectedBuildingId, setSelectedBuildingId]);

    const buildingNameById = useMemo(() => (buildings ?? []).reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {}), [buildings]);

    const assigneeOptions = useMemo(() => (allRequests ?? []).reduce<Array<{ value: AssigneeFilterValue; label: string }>>((acc, request) => {
        const value = getAssigneeFilterValue(request);
        if (value === "UNASSIGNED" || acc.some((option) => option.value === value)) return acc;
        acc.push({ value, label: getAssigneeFilterLabel(request) });
        return acc;
    }, []), [allRequests]);

    const resolvedAssigneeFilter = useMemo(() => {
        if (assigneeFilter === "ALL" || assigneeFilter === "UNASSIGNED") return assigneeFilter;
        return assigneeOptions.some((option) => option.value === assigneeFilter) ? assigneeFilter : "ALL";
    }, [assigneeFilter, assigneeOptions]);

    const normalizedSearch = deferredSearchValue.trim().toLowerCase();
    const requests = [...(allRequests ?? [])]
        .filter((request) => {
            const workflow = getRequestWorkflowBucket(request);
            if (workflowFilter === "ALL_OPEN") {
                return workflow !== "CLOSED" && workflow !== "HISTORICAL";
            }
            return workflow === workflowFilter;
        })
        .filter((request) => {
            if (priorityFilter === "ALL") return true;
            if (priorityFilter === "EMERGENCY") return Boolean(request.policy?.isEmergency || request.isEmergency);
            return request.priority === priorityFilter;
        })
        .filter((request) => resolvedAssigneeFilter === "ALL" || getAssigneeFilterValue(request) === resolvedAssigneeFilter)
        .filter((request) => lifecycleFilter === "ALL" || request.status === lifecycleFilter)
        .filter((request) => contextFilter === "ALL" || getRequestTenancyBucket(request.requestTenancyContext) === contextFilter)
        .filter((request) => {
            if (approvalFilter === "ALL") return true;
            const requestApprovalStatus = request.ownerApproval?.status ?? request.ownerApprovalStatus ?? "NOT_REQUIRED";
            return requestApprovalStatus === approvalFilter;
        })
        .filter((request) => !normalizedSearch || getRequestSearchHaystack(request, buildingNameById).includes(normalizedSearch))
        .sort((left, right) => {
            const createdDelta = getTimeValue(right.createdAt) - getTimeValue(left.createdAt);
            if (createdDelta !== 0) return createdDelta;
            return getTimeValue(right.updatedAt) - getTimeValue(left.updatedAt);
        });

    useEffect(() => {
        if (!selectedRequest) return;
        if (!(allRequests ?? []).some((request) => request.id === selectedRequest.id)) {
            setSelectedRequest(null);
        }
    }, [allRequests, selectedRequest]);

    useEffect(() => {
        if (!requestedNotificationRequestId) {
            handledNotificationRequestIdRef.current = null;
            return;
        }
        if (handledNotificationRequestIdRef.current === requestedNotificationRequestId) return;
        if (!allRequests) return;
        const matchedRequest = (allRequests ?? []).find((request) => request.id === requestedNotificationRequestId);
        handledNotificationRequestIdRef.current = requestedNotificationRequestId;
        if (selectedRequest?.id !== matchedRequest?.id) {
            setSelectedRequest(matchedRequest ?? null);
        }
        router.replace(getPathWithoutSearchParams(pathname, searchParams, ["requestId"]), { scroll: false });
    }, [allRequests, pathname, requestedNotificationRequestId, router, searchParams, selectedRequest?.id]);

    const canSwitchBuildings = (buildings?.length ?? 0) > 1;
    const buildingScopeValue = selectedBuildingId ?? ALL_BUILDINGS_VALUE;
    const activeBuildingName = selectedBuildingId
        ? buildings?.find((building) => building.id === selectedBuildingId)?.name ?? selectedBuildingId
        : "All buildings";
    const handleBuildingScopeChange = (value: string) => {
        const nextBuildingId = value === ALL_BUILDINGS_VALUE ? null : value;
        setSelectedBuildingId(nextBuildingId);
        setSelectedRequest(null);
        router.replace(getPathWithSearchParamUpdates(pathname, searchParams, {
            buildingId: nextBuildingId,
            requestId: null,
        }), { scroll: false });
    };
    const workflowFilterOptions = [...primaryWorkflowFilters, ...secondaryWorkflowFilters];
    const hasAdvancedFilters = lifecycleFilter !== "ALL" || contextFilter !== "ALL" || approvalFilter !== "ALL";
    const activeFilterChips = [
        `Workflow: ${workflowBucketLabels[workflowFilter]}`,
        canSwitchBuildings ? `Building: ${activeBuildingName}` : null,
        priorityFilter !== "ALL" ? `Priority: ${priorityFilterLabels[priorityFilter]}` : null,
        resolvedAssigneeFilter !== "ALL"
            ? `Assignee: ${resolvedAssigneeFilter === "UNASSIGNED"
                ? "Unassigned"
                : assigneeOptions.find((option) => option.value === resolvedAssigneeFilter)?.label ?? "Assigned"}`
            : null,
        lifecycleFilter !== "ALL" ? `Request status: ${lifecycleFilterLabels[lifecycleFilter]}` : null,
        contextFilter !== "ALL" ? `Request context: ${contextFilterLabels[contextFilter]}` : null,
        approvalFilter !== "ALL" ? `Approval: ${approvalFilterLabels[approvalFilter]}` : null,
        normalizedSearch ? `Search: ${deferredSearchValue.trim()}` : null,
    ].filter(Boolean) as string[];

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
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Service Requests</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                            Track, assign, and resolve maintenance work across your buildings.
                        </p>
                    </div>

                    {(buildings?.length ?? 0) > 0 ? (
                        <div className="rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-[190px]">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                        Building scope
                                    </div>
                                    {canSwitchBuildings ? (
                                        <Select
                                            value={buildingScopeValue}
                                            onValueChange={handleBuildingScopeChange}
                                        >
                                            <SelectTrigger className="mt-1 h-auto w-full border-none bg-transparent p-0 text-left text-sm font-semibold text-zinc-900 shadow-none focus:ring-0">
                                                <SelectValue placeholder={activeBuildingName} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ALL_BUILDINGS_VALUE}>All buildings</SelectItem>
                                                {buildings?.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        {building.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="mt-1 text-sm font-semibold text-zinc-900">{activeBuildingName}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-6">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-950">Search and filter</h2>
                        <p className="mt-1 text-sm text-zinc-500">Use the filters below to narrow workflow, ownership, lifecycle, or context.</p>
                    </div>

                    <div className="rounded-[26px] border border-zinc-200 bg-white p-4 sm:p-5">
                        <div className="grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                            <FilterField label="Search">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        value={searchValue}
                                        onChange={(event) => setSearchValue(event.target.value)}
                                        placeholder="Search requests, locations, or IDs..."
                                        className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-10 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                    />
                                </div>
                            </FilterField>

                            <FilterField label="Priority">
                                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilterValue)}>
                                    <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                        <SelectValue placeholder={priorityFilterLabels[priorityFilter]} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(priorityFilterLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FilterField>

                            <FilterField label="Assignee">
                                <Select value={resolvedAssigneeFilter} onValueChange={(value) => setAssigneeFilter(value as AssigneeFilterValue)}>
                                    <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                        <SelectValue
                                            placeholder={resolvedAssigneeFilter === "ALL"
                                                ? "Any assignee"
                                                : resolvedAssigneeFilter === "UNASSIGNED"
                                                    ? "Unassigned"
                                                    : assigneeOptions.find((option) => option.value === resolvedAssigneeFilter)?.label ?? "Assigned"}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Any assignee</SelectItem>
                                        <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                                        {assigneeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FilterField>

                            <FilterField label="Workflow" hint="Includes closed and historical only when explicitly selected.">
                                <Select value={workflowFilter} onValueChange={(value) => setWorkflowFilter(value as WorkflowFilterValue)}>
                                    <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                        <SelectValue placeholder={workflowBucketLabels[workflowFilter]} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {workflowFilterOptions.map((value) => (
                                            <SelectItem key={value} value={value}>{workflowBucketLabels[value]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FilterField>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    type="button"
                                    variant={showAdvancedFilters ? "secondary" : "outline"}
                                    className="rounded-full"
                                    onClick={() => setShowAdvancedFilters((value) => !value)}
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    More filters
                                </Button>

                                {hasAdvancedFilters ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLifecycleFilter("ALL");
                                            setContextFilter("ALL");
                                            setApprovalFilter("ALL");
                                        }}
                                        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
                                    >
                                        Clear advanced filters
                                    </button>
                                ) : null}
                            </div>

                            <div className="text-sm text-zinc-500">Advanced filters narrow lifecycle, context, and approval.</div>
                        </div>

                        {showAdvancedFilters ? (
                            <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-zinc-100 pt-4 lg:grid-cols-3">
                                <FilterField label="Request status">
                                    <Select value={lifecycleFilter} onValueChange={(value) => setLifecycleFilter(value as LifecycleFilterValue)}>
                                        <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                            <SelectValue placeholder={lifecycleFilterLabels[lifecycleFilter]} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(lifecycleFilterLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>

                                <FilterField label="Request context">
                                    <Select value={contextFilter} onValueChange={(value) => setContextFilter(value as ContextFilterValue)}>
                                        <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                            <SelectValue placeholder={contextFilterLabels[contextFilter]} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(contextFilterLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>

                                <FilterField label="Approval state">
                                    <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as ApprovalFilterValue)}>
                                        <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                            <SelectValue placeholder={approvalFilterLabels[approvalFilter]} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(approvalFilterLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                            </div>
                        ) : null}

                        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {activeFilterChips.map((chip) => (
                                    <span key={chip} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700">
                                        {chip}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                {(normalizedSearch || priorityFilter !== "ALL" || assigneeFilter !== "ALL" || workflowFilter !== "ALL_OPEN" || hasAdvancedFilters) ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWorkflowFilter("ALL_OPEN");
                                            setPriorityFilter("ALL");
                                            setAssigneeFilter("ALL");
                                            setLifecycleFilter("ALL");
                                            setContextFilter("ALL");
                                            setApprovalFilter("ALL");
                                            setSearchValue("");
                                        }}
                                        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
                                    >
                                        Reset filters
                                    </button>
                                ) : null}

                                <span className="rounded-full border border-zinc-950 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white">
                                    {requests.length} request{requests.length === 1 ? "" : "s"} in current view
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <RequestsTable
                requests={requests}
                isLoading={isLoading}
                onSelect={setSelectedRequest}
                buildingNameById={buildingNameById}
                showBuilding={canSwitchBuildings && !selectedBuildingId}
            />

            <RequestDetailSheet
                requestId={selectedRequest?.id ?? null}
                buildingId={selectedRequest?.buildingId ?? null}
                buildingNameById={buildingNameById}
                onClose={() => setSelectedRequest(null)}
            />
        </div>
    );
}
