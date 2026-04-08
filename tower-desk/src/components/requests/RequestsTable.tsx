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
    statusStyles
} from "@/components/requests/requestDisplay";
import { ServiceRequest } from "@/lib/types";

interface RequestsTableProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
}

export function RequestsTable({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
}: RequestsTableProps) {
    const getCreatedByLabel = (request: ServiceRequest) =>
        request.createdBy?.name
        ?? request.createdBy?.fullName
        ?? request.createdBy?.email
        ?? request.createdByTenantId
        ?? "Unknown";

    const getAssignmentSummary = (request: ServiceRequest) => {
        const staffLabel = request.assignedTo?.fullName ?? request.assignedTo?.email;
        const providerWorkerLabel = request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email;
        const entries = [
            staffLabel ? `Staff: ${staffLabel}` : null,
            request.serviceProvider?.name ? `Provider: ${request.serviceProvider.name}` : null,
            providerWorkerLabel ? `Worker: ${providerWorkerLabel}` : null,
        ].filter(Boolean);
        return entries.length > 0 ? entries : ["Unassigned"];
    };

    if (isLoading) {
        const skeletonRows = [
            { key: 1, className: "" },
            { key: 2, className: "" },
            { key: 3, className: "hidden sm:block" },
            { key: 4, className: "hidden lg:block" },
        ];

        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                {skeletonRows.map((row) => (
                    <Skeleton key={row.key} className={`h-10 w-full ${row.className}`} />
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-md border border-zinc-200 bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests?.map((req) => (
                        <TableRow
                            key={req.id}
                            className={onSelect ? "cursor-pointer transition-colors hover:bg-zinc-50" : undefined}
                            onClick={() => onSelect?.(req)}
                        >
                            <TableCell className="whitespace-normal">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-medium text-zinc-900">{req.title}</div>
                                        <Badge variant="outline" className={priorityStyles[req.priority]}>
                                            {req.priority}
                                        </Badge>
                                        {req.policy?.isEmergency ? (
                                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                                Emergency
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-zinc-500 line-clamp-1">{req.description}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`inline-flex items-center gap-1 ${statusStyles[req.status]}`}>
                                    {getStatusIcon(req.status)}
                                    <span>{statusLabels[req.status]}</span>
                                </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-600">
                                <div className="flex flex-wrap gap-2">
                                    {req.queue ? (
                                        <Badge variant="outline" className={requestQueueStyles[req.queue]}>
                                            {requestQueueLabels[req.queue]}
                                        </Badge>
                                    ) : null}
                                    <Badge
                                        variant="outline"
                                        className={ownerApprovalStatusStyles[req.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? ownerApprovalStatusStyles.NOT_REQUIRED}
                                    >
                                        {ownerApprovalStatusLabels[req.ownerApprovalStatus ?? "NOT_REQUIRED"] ?? req.ownerApprovalStatus ?? "Owner approval"}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className={estimateStatusStyles[req.estimate?.status ?? "NOT_REQUESTED"] ?? estimateStatusStyles.NOT_REQUESTED}
                                    >
                                        {estimateStatusLabels[req.estimate?.status ?? "NOT_REQUESTED"] ?? req.estimate?.status ?? "Estimate"}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell className="text-zinc-600">
                                <div className="space-y-1">
                                    {getAssignmentSummary(req).map((entry) => (
                                        <div key={entry} className="text-xs text-zinc-600">
                                            {entry}
                                        </div>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-zinc-600">
                                {getCreatedByLabel(req)}
                            </TableCell>
                            <TableCell className="text-zinc-600">
                                <div className="space-y-1">
                                    <div>{req.unit?.label ?? req.unit?.number ?? req.unit?.id ?? "N/A"}</div>
                                    {typeof req.unit?.floor === "number" ? (
                                        <div className="text-xs text-zinc-400">Floor {req.unit.floor}</div>
                                    ) : null}
                                </div>
                            </TableCell>
                            <TableCell className="text-zinc-500">
                                {buildingNameById?.[req.buildingId] || req.buildingId}
                            </TableCell>
                            <TableCell className="text-zinc-500">
                                {new Date(req.createdAt).toLocaleDateString()}
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!requests || requests.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={8}>
                                <div className="py-8">
                                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                                            <ClipboardList className="h-6 w-6 text-zinc-400" />
                                        </div>
                                        <h3 className="mt-4 text-sm font-semibold text-zinc-900">No requests found</h3>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            No service requests match the current filter.
                                        </p>
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
