"use client";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    getRequestContextLabel,
    getRequestAssignedStaff,
    getRequestNextAction,
    getRequestTargetDate,
    getWorkflowBucketStyle,
    isRequestPastDue,
    priorityStyles,
    statusLabels,
} from "@/components/requests/requestDisplay";
import type { ServiceRequest } from "@/lib/types";

interface RequestsTableProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
    showBuilding?: boolean;
}

const formatDate = (value?: string | null) => {
    if (!value) return "No date";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const getPriorityBadge = (request: ServiceRequest) => {
    if (request.policy?.isEmergency || request.isEmergency) {
        return {
            label: "Emergency",
            className: "border-rose-200 bg-rose-50 text-rose-700",
        };
    }

    return {
        label: `${request.priority.charAt(0).toUpperCase()}${request.priority.slice(1)} priority`,
        className: priorityStyles[request.priority],
    };
};

const getAssignmentSummary = (request: ServiceRequest) => {
    const staff = getRequestAssignedStaff(request);
    const staffLabel = staff?.name ?? staff?.email;
    const providerLabel = request.serviceProvider?.name;
    const workerLabel = request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email;

    if (workerLabel) {
        return {
            primary: workerLabel,
            secondary: providerLabel ? `${providerLabel} worker` : "External provider",
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
            secondary: "External provider",
        };
    }

    return {
        primary: "Unassigned",
        secondary: "No owner yet",
    };
};

const getDueSummary = (request: ServiceRequest) => {
    const targetDate = getRequestTargetDate(request);
    const overdue = isRequestPastDue(request);

    if (request.ownerApproval?.deadlineAt) {
        return {
            primary: formatDate(targetDate),
            secondary: "Owner response due",
            overdue,
        };
    }

    if (request.estimate?.dueAt) {
        return {
            primary: formatDate(targetDate),
            secondary: "Estimate due",
            overdue,
        };
    }

    if (request.queue === "OVERDUE") {
        return {
            primary: "Overdue",
            secondary: "Past target date",
            overdue: true,
        };
    }

    return {
        primary: "No target date",
        secondary: "No SLA on record",
        overdue: false,
    };
};

const getLocationSummary = (request: ServiceRequest, buildingNameById?: Record<string, string>, showBuilding = false) => {
    const location = request.unit?.label ?? request.unit?.number ?? request.unit?.id ?? "Location pending";
    const details = [];

    if (typeof request.unit?.floor === "number") {
        details.push(`Floor ${request.unit.floor}`);
    }
    if (showBuilding) {
        details.push(buildingNameById?.[request.buildingId] ?? request.buildingName ?? request.buildingId);
    }

    return {
        primary: location,
        secondary: details.length > 0 ? details.join(" / ") : "No floor or building detail",
    };
};

function EmptyState() {
    return (
        <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/60 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <ClipboardList className="h-6 w-6 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-950">No requests found</h3>
            <p className="mt-1 text-sm text-zinc-500">
                Try adjusting the workflow, ownership, or search filters.
            </p>
        </div>
    );
}

export function RequestsTable({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
    showBuilding = false,
}: RequestsTableProps) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="grid gap-3 md:hidden">
                    {[1, 2, 3].map((row) => (
                        <Skeleton key={row} className="h-48 rounded-[24px]" />
                    ))}
                </div>
                <div className="hidden rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm md:block">
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((row) => (
                            <Skeleton key={row} className="h-16 w-full rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-3 md:hidden">
                {requests.map((request) => {
                    const assignment = getAssignmentSummary(request);
                    const nextAction = getRequestNextAction(request);
                    const location = getLocationSummary(request, buildingNameById, showBuilding);
                    const due = getDueSummary(request);
                    const priority = getPriorityBadge(request);
                    const showOverdueBadge = isRequestPastDue(request) && nextAction.workflow !== "OVERDUE";

                    return (
                        <div
                            key={request.id}
                            className={onSelect ? "cursor-pointer rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50" : "rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm"}
                            onClick={() => onSelect?.(request)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-base font-semibold text-zinc-950">{request.title}</div>
                                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-600">
                                        {request.description || "No description provided."}
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Badge variant="outline" className={priority.className}>{priority.label}</Badge>
                                    {showOverdueBadge ? (
                                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Overdue</Badge>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-zinc-500">
                                {getRequestContextLabel(request)} / {statusLabels[request.status]}
                            </div>

                            <div className="mt-4 space-y-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Next action</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className={getWorkflowBucketStyle(nextAction.workflow)}>{nextAction.label}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm text-zinc-700">{nextAction.detail}</p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Assignee</div>
                                        <div className="mt-1 text-sm font-medium text-zinc-950">{assignment.primary}</div>
                                        <div className="text-xs text-zinc-500">{assignment.secondary}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Location</div>
                                        <div className="mt-1 text-sm font-medium text-zinc-950">{location.primary}</div>
                                        <div className="text-xs text-zinc-500">{location.secondary}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Due / SLA</div>
                                        <div className={due.overdue ? "mt-1 text-sm font-medium text-rose-700" : "mt-1 text-sm font-medium text-zinc-950"}>{due.primary}</div>
                                        <div className={due.overdue ? "text-xs text-rose-600" : "text-xs text-zinc-500"}>{due.secondary}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Created</div>
                                        <div className="mt-1 text-sm font-medium text-zinc-950">{formatDate(request.createdAt)}</div>
                                        <div className="text-xs text-zinc-500">Updated {formatDate(request.updatedAt)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm md:block">
                <Table>
                    <TableHeader className="bg-zinc-50">
                        <TableRow className="border-zinc-200 hover:bg-zinc-50">
                            <TableHead className="h-12 px-4">Request</TableHead>
                            <TableHead className="h-12 px-4">Next Action</TableHead>
                            <TableHead className="h-12 px-4">Assignee</TableHead>
                            <TableHead className="h-12 px-4">Location</TableHead>
                            <TableHead className="h-12 px-4">Due / SLA</TableHead>
                            <TableHead className="h-12 px-4">Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((request) => {
                            const assignment = getAssignmentSummary(request);
                            const nextAction = getRequestNextAction(request);
                            const location = getLocationSummary(request, buildingNameById, showBuilding);
                            const due = getDueSummary(request);
                            const priority = getPriorityBadge(request);
                            const showOverdueBadge = isRequestPastDue(request) && nextAction.workflow !== "OVERDUE";

                            return (
                                <TableRow
                                    key={request.id}
                                    className={onSelect ? "cursor-pointer border-zinc-100 hover:bg-zinc-50/80" : "border-zinc-100"}
                                    onClick={() => onSelect?.(request)}
                                >
                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="max-w-[340px] space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-[15px] font-semibold leading-6 text-zinc-950">{request.title}</div>
                                                <Badge variant="outline" className={priority.className}>{priority.label}</Badge>
                                                {showOverdueBadge ? (
                                                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Overdue</Badge>
                                                ) : null}
                                            </div>
                                            <p className="line-clamp-1 text-sm leading-5 text-zinc-600">
                                                {request.description || "No description provided."}
                                            </p>
                                            <div className="text-xs text-zinc-500">
                                                {getRequestContextLabel(request)} / {statusLabels[request.status]}
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="max-w-[260px] space-y-2">
                                            <Badge variant="outline" className={getWorkflowBucketStyle(nextAction.workflow)}>{nextAction.label}</Badge>
                                            <div className="text-sm leading-5 text-zinc-700">{nextAction.detail}</div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="min-w-[160px] space-y-1">
                                            <div className="font-medium text-zinc-950">{assignment.primary}</div>
                                            <div className="text-xs leading-5 text-zinc-500">{assignment.secondary}</div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="min-w-[150px] space-y-1">
                                            <div className="font-medium text-zinc-950">{location.primary}</div>
                                            <div className="text-xs leading-5 text-zinc-500">{location.secondary}</div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="min-w-[140px] space-y-1">
                                            <div className={due.overdue ? "font-medium text-rose-700" : "font-medium text-zinc-950"}>{due.primary}</div>
                                            <div className={due.overdue ? "text-xs leading-5 text-rose-600" : "text-xs leading-5 text-zinc-500"}>{due.secondary}</div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                                        <div className="min-w-[130px] space-y-1">
                                            <div className="font-medium text-zinc-950">{formatDate(request.createdAt)}</div>
                                            <div className="text-xs leading-5 text-zinc-500">Updated {formatDate(request.updatedAt)}</div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
