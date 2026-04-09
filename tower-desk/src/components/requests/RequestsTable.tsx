"use client";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ServiceRequest } from "@/lib/types";

interface RequestsTableProps {
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

export function RequestsTable({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
    showBuilding = false,
}: RequestsTableProps) {
    if (isLoading) {
        const skeletonRows = [
            { key: 1, className: "" },
            { key: 2, className: "" },
            { key: 3, className: "hidden lg:block" },
            { key: 4, className: "hidden xl:block" },
        ];

        return (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="space-y-3">
                    {skeletonRows.map((row) => (
                        <Skeleton key={row.key} className={`h-14 w-full rounded-2xl ${row.className}`} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
            <Table>
                <TableHeader className="bg-zinc-50/80">
                    <TableRow className="border-zinc-200 hover:bg-zinc-50/80">
                        <TableHead className="h-12 px-4">Request</TableHead>
                        <TableHead className="h-12 px-4">Status</TableHead>
                        <TableHead className="h-12 px-4">Workflow</TableHead>
                        <TableHead className="h-12 px-4">Assigned To</TableHead>
                        <TableHead className="h-12 px-4">Location</TableHead>
                        <TableHead className="h-12 px-4">Date</TableHead>
                        <TableHead className="h-12 px-4">Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests?.map((request) => {
                        const assignment = getAssignmentSummary(request);
                        const locationLabel = request.unit?.label ?? request.unit?.number ?? request.unit?.id ?? "N/A";
                        const activityDate = request.completedAt ?? request.updatedAt ?? request.createdAt;
                        const statusLabel = statusLabels[request.status];
                        const queueLabel = request.queue ? requestQueueLabels[request.queue] : null;
                        const shouldShowQueueBadge = Boolean(queueLabel) && queueLabel !== statusLabel;

                        return (
                            <TableRow
                                key={request.id}
                                className={onSelect ? "group cursor-pointer border-zinc-100 hover:bg-zinc-50/80" : "border-zinc-100"}
                                onClick={() => onSelect?.(request)}
                            >
                                <TableCell className="px-4 py-4 align-top whitespace-normal">
                                    <div className="max-w-xl space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-[15px] font-semibold leading-6 text-zinc-950 transition-colors group-hover:text-zinc-700">
                                                {request.title}
                                            </div>
                                            <Badge variant="outline" className={`capitalize ${priorityStyles[request.priority]}`}>
                                                {request.priority}
                                            </Badge>
                                            {request.policy?.isEmergency || request.isEmergency ? (
                                                <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                                    Emergency
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="line-clamp-2 text-sm leading-5 text-zinc-500">
                                            {request.description || "No description provided."}
                                        </p>
                                    </div>
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top">
                                    <Badge variant="outline" className={`inline-flex items-center gap-1 ${statusStyles[request.status]}`}>
                                        {getStatusIcon(request.status)}
                                        <span>{statusLabels[request.status]}</span>
                                    </Badge>
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top">
                                    <div className="flex max-w-xs flex-wrap gap-2">
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
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top whitespace-normal">
                                    <div className="min-w-[150px] space-y-1">
                                        <div className="font-medium text-zinc-900">{assignment.primary}</div>
                                        <div className="text-xs leading-5 text-zinc-500">{assignment.secondary}</div>
                                    </div>
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top whitespace-normal">
                                    <div className="min-w-[140px] space-y-1">
                                        <div className="font-medium text-zinc-900">{locationLabel}</div>
                                        {typeof request.unit?.floor === "number" ? (
                                            <div className="text-xs text-zinc-500">Floor {request.unit.floor}</div>
                                        ) : (
                                            <div className="text-xs text-zinc-400">Floor not set</div>
                                        )}
                                        {showBuilding ? (
                                            <div className="text-xs text-zinc-400">
                                                {buildingNameById?.[request.buildingId] || request.buildingName || request.buildingId}
                                            </div>
                                        ) : null}
                                    </div>
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top text-sm text-zinc-600">
                                    {formatDate(activityDate)}
                                </TableCell>

                                <TableCell className="px-4 py-4 align-top text-sm text-zinc-500">
                                    {formatDate(request.createdAt)}
                                </TableCell>
                            </TableRow>
                        );
                    })}

                    {(!requests || requests.length === 0) && (
                        <TableRow className="hover:bg-white">
                            <TableCell colSpan={7} className="px-4 py-10">
                                <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/60 p-10 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                                        <ClipboardList className="h-6 w-6 text-zinc-400" />
                                    </div>
                                    <h3 className="mt-4 text-sm font-semibold text-zinc-950">No requests found</h3>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Try adjusting the status, priority, or search filters.
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
