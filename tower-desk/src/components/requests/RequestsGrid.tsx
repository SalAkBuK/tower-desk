"use client";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    estimateStatusLabels,
    estimateStatusStyles,
    getStatusIcon,
    ownerApprovalStatusLabels,
    ownerApprovalStatusStyles,
    priorityStyles,
    requestQueueLabels,
    requestQueueStyles,
    statusLabels,
    statusStyles,
} from "@/components/requests/requestDisplay";
import {
    getRequestLeaseRowBadgeLabel,
    getRequestTenancyBucket,
    getRequestTenancyRowBadgeLabel,
} from "@/lib/requestTenancyContext";
import type { ServiceRequest } from "@/lib/types";

interface RequestsGridProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
    showBuilding?: boolean;
}

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const getAssignmentSummary = (request: ServiceRequest) => {
    const staffLabel = request.assignedTo?.fullName ?? request.assignedTo?.email;
    const providerLabel = request.serviceProvider?.name;
    const workerLabel = request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email;

    if (workerLabel) {
        return {
            primary: workerLabel,
            secondary: providerLabel ? `${providerLabel} worker` : "Assigned provider worker",
        };
    }
    if (staffLabel) {
        return {
            primary: staffLabel,
            secondary: "Building staff",
        };
    }
    if (providerLabel) {
        return {
            primary: providerLabel,
            secondary: "Service provider assigned",
        };
    }

    return {
        primary: "Unassigned",
        secondary: "Waiting for assignment",
    };
};

const getTenancyRowBadgeClasses = (request: ServiceRequest) => {
    switch (getRequestTenancyBucket(request.requestTenancyContext)) {
        case "CURRENT":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "HISTORICAL":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "LEGACY":
        default:
            return "border-zinc-200 bg-zinc-100 text-zinc-700";
    }
};

const getLeaseRowBadgeClasses = (request: ServiceRequest) => {
    switch (request.requestTenancyContext?.leaseLabel) {
        case "CURRENT_LEASE":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "PREVIOUS_LEASE":
        case "NO_ACTIVE_LEASE":
            return "border-orange-200 bg-orange-50 text-orange-700";
        case "UNKNOWN_LEASE_CYCLE":
        default:
            return "border-zinc-200 bg-zinc-100 text-zinc-600";
    }
};

export function RequestsGrid({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
    showBuilding = false,
}: RequestsGridProps) {
    if (isLoading) {
        const skeletonCards = [
            { key: 1, className: "" },
            { key: 2, className: "" },
            { key: 3, className: "hidden sm:block" },
            { key: 4, className: "hidden xl:block" },
        ];

        return (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {skeletonCards.map((item) => (
                    <div key={item.key} className={`rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm ${item.className}`}>
                        <Skeleton className="h-5 w-2/3 rounded-full" />
                        <Skeleton className="mt-4 h-4 w-full rounded-full" />
                        <Skeleton className="mt-2 h-4 w-5/6 rounded-full" />
                        <Skeleton className="mt-6 h-20 w-full rounded-[20px]" />
                    </div>
                ))}
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return (
            <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50">
                    <ClipboardList className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-950">No requests found</h3>
                <p className="mt-1 text-sm text-zinc-500">Try adjusting the status, priority, or search filters.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {requests.map((request) => {
                const assignment = getAssignmentSummary(request);
                const locationLabel = request.unit?.label ?? request.unit?.number ?? request.unit?.id ?? "N/A";
                const activityDate = request.completedAt ?? request.updatedAt ?? request.createdAt;
                const statusLabel = statusLabels[request.status];
                const queueLabel = request.queue ? requestQueueLabels[request.queue] : null;
                const shouldShowQueueBadge = Boolean(queueLabel) && queueLabel !== statusLabel;

                return (
                    <Card
                        key={request.id}
                        className={onSelect ? "rounded-[28px] border-zinc-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg" : "rounded-[28px] border-zinc-200 shadow-sm"}
                        onClick={() => onSelect?.(request)}
                    >
                        <CardContent className="space-y-5 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className={`inline-flex items-center gap-1 ${statusStyles[request.status]}`}>
                                            {getStatusIcon(request.status)}
                                            <span>{statusLabels[request.status]}</span>
                                        </Badge>
                                        <Badge variant="outline" className={`capitalize ${priorityStyles[request.priority]}`}>
                                            {request.priority}
                                        </Badge>
                                        <Badge variant="outline" className={getTenancyRowBadgeClasses(request)}>
                                            {getRequestTenancyRowBadgeLabel(request.requestTenancyContext)}
                                        </Badge>
                                        {request.requestTenancyContext?.leaseLabel ? (
                                            <Badge variant="outline" className={getLeaseRowBadgeClasses(request)}>
                                                {getRequestLeaseRowBadgeLabel(request.requestTenancyContext)}
                                            </Badge>
                                        ) : null}
                                        {request.policy?.isEmergency || request.isEmergency ? (
                                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                                Emergency
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">{request.title}</h3>
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                                            {request.description || "No description provided."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {request.queue && shouldShowQueueBadge ? (
                                    <Badge variant="outline" className={requestQueueStyles[request.queue]}>
                                        {queueLabel}
                                    </Badge>
                                ) : null}
                                <Badge
                                    variant="outline"
                                    className={ownerApprovalStatusStyles[request.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? ownerApprovalStatusStyles.NOT_REQUIRED}
                                >
                                    {ownerApprovalStatusLabels[request.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? "Owner approval"}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={estimateStatusStyles[request.estimate?.status ?? "NOT_REQUESTED"] ?? estimateStatusStyles.NOT_REQUESTED}
                                >
                                    {estimateStatusLabels[request.estimate?.status ?? "NOT_REQUESTED"] ?? "Estimate"}
                                </Badge>
                            </div>

                            <div className="grid gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 sm:grid-cols-2">
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Assigned To</div>
                                    <div className="mt-1 font-medium text-zinc-950">{assignment.primary}</div>
                                    <div className="mt-1 text-xs text-zinc-500">{assignment.secondary}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Location</div>
                                    <div className="mt-1 font-medium text-zinc-950">{locationLabel}</div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                        {typeof request.unit?.floor === "number" ? `Floor ${request.unit.floor}` : "Floor not set"}
                                    </div>
                                    {showBuilding ? (
                                        <div className="mt-1 text-xs text-zinc-400">
                                            {buildingNameById?.[request.buildingId] || request.buildingName || request.buildingId}
                                        </div>
                                    ) : null}
                                </div>
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Date</div>
                                    <div className="mt-1 font-medium text-zinc-950">{formatDate(activityDate)}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Created</div>
                                    <div className="mt-1 font-medium text-zinc-950">{formatDate(request.createdAt)}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
