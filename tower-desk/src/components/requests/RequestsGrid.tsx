"use client";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServiceRequest } from "@/lib/types";
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

interface RequestsGridProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
}

const getCreatedByLabel = (request: ServiceRequest) =>
    request.createdBy?.name
    ?? request.createdBy?.fullName
    ?? request.createdBy?.email
    ?? request.createdByTenantId
    ?? "Unknown";

const getStaffLabel = (request: ServiceRequest) => request.assignedTo?.fullName ?? request.assignedTo?.email;
const getProviderWorkerLabel = (request: ServiceRequest) => request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email;

export function RequestsGrid({ requests, isLoading, onSelect, buildingNameById }: RequestsGridProps) {
    if (isLoading) {
        const skeletonCards = [
            { key: 1, className: "" },
            { key: 2, className: "" },
            { key: 3, className: "hidden sm:block" },
            { key: 4, className: "hidden sm:block" },
            { key: 5, className: "hidden xl:block" },
            { key: 6, className: "hidden xl:block" },
        ];

        return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {skeletonCards.map((item) => (
                    <div key={item.key} className={`rounded-xl border border-zinc-200 bg-white p-4 ${item.className}`}>
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="mt-3 h-4 w-full" />
                        <Skeleton className="mt-2 h-4 w-5/6" />
                        <Skeleton className="mt-6 h-5 w-24" />
                    </div>
                ))}
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                    <ClipboardList className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-900">No requests found</h3>
                <p className="mt-1 text-xs text-zinc-500">No service requests match the current filter.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {requests.map((request) => (
                <Card
                    key={request.id}
                    className={`border-zinc-200 ${onSelect ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md" : ""}`}
                    onClick={() => onSelect?.(request)}
                >
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle className="text-base font-semibold text-zinc-900">{request.title}</CardTitle>
                                    <Badge variant="outline" className={`h-5 px-1.5 text-[10px] capitalize ${priorityStyles[request.priority]}`}>
                                        {request.priority}
                                    </Badge>
                                    {request.policy?.isEmergency ? (
                                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                            Emergency
                                        </Badge>
                                    ) : null}
                                </div>
                                <p className="text-sm text-zinc-500 line-clamp-2">{request.description}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {request.queue ? (
                                <Badge variant="outline" className={requestQueueStyles[request.queue]}>
                                    {requestQueueLabels[request.queue]}
                                </Badge>
                            ) : null}
                            <Badge variant="outline" className={`inline-flex items-center gap-1 ${statusStyles[request.status]}`}>
                                {getStatusIcon(request.status)}
                                <span>{statusLabels[request.status]}</span>
                            </Badge>
                            <Badge
                                variant="outline"
                                className={ownerApprovalStatusStyles[request.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? ownerApprovalStatusStyles.NOT_REQUIRED}
                            >
                                {ownerApprovalStatusLabels[request.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? request.ownerApprovalStatus ?? "Owner approval"}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={estimateStatusStyles[request.estimate?.status ?? "NOT_REQUESTED"] ?? estimateStatusStyles.NOT_REQUESTED}
                            >
                                {estimateStatusLabels[request.estimate?.status ?? "NOT_REQUESTED"] ?? request.estimate?.status ?? "Estimate"}
                            </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-zinc-500">
                            <div>
                                Unit {request.unit?.label ?? request.unit?.number ?? request.unit?.id ?? "N/A"}
                                {typeof request.unit?.floor === "number" ? ` | Floor ${request.unit.floor}` : ""}
                            </div>
                            <div>Created by: {getCreatedByLabel(request)}</div>
                            {getStaffLabel(request) ? <div>Staff: {getStaffLabel(request)}</div> : null}
                            {request.serviceProvider ? <div>Provider: {request.serviceProvider.name ?? request.serviceProvider.id}</div> : null}
                            {getProviderWorkerLabel(request) ? <div>Worker: {getProviderWorkerLabel(request)}</div> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                            <span>{buildingNameById?.[request.buildingId] || request.buildingId}</span>
                            <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
