"use client";

import { AlertCircle, CheckCircle2, ClipboardList, Clock } from "lucide-react";

import type {
    OwnerApprovalStatus,
    RequestEstimateStatus,
    RequestPolicyRoute,
    RequestPriority,
    RequestQueue,
    RequestRecommendation,
    RequestStatus,
    ServiceRequest,
} from "@/lib/types";
import { getPrimaryManagementQueue, isClosedManagementRequest } from "@/lib/requestQueueManagement";
import { getRequestTenancyBucket, getRequestTenancyRowBadgeLabel } from "@/lib/requestTenancyContext";

export const priorityStyles: Record<RequestPriority, string> = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    medium: "border-yellow-200 bg-yellow-50 text-yellow-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    urgent: "border-red-200 bg-red-50 text-red-700",
};

export const statusStyles: Record<RequestStatus, string> = {
    pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    assigned: "border-purple-200 bg-purple-50 text-purple-700",
    "in-progress": "border-blue-200 bg-blue-50 text-blue-700",
    "on-hold": "border-gray-200 bg-gray-100 text-gray-700",
    completed: "border-green-200 bg-green-50 text-green-700",
    cancelled: "border-red-200 bg-red-50 text-red-700",
};

export const statusLabels: Record<RequestStatus, string> = {
    pending: "Open",
    assigned: "Assigned",
    "in-progress": "In Progress",
    "on-hold": "On Hold",
    completed: "Completed",
    cancelled: "Canceled",
};

export const requestQueueLabels: Record<RequestQueue, string> = {
    NEW: "New",
    NEEDS_ESTIMATE: "Needs Estimate",
    AWAITING_ESTIMATE: "Awaiting Estimate",
    AWAITING_OWNER: "Awaiting Owner",
    READY_TO_ASSIGN: "Ready to Assign",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    OVERDUE: "Overdue",
};

export const requestQueueStyles: Record<RequestQueue, string> = {
    NEW: "border-slate-200 bg-slate-100 text-slate-700",
    NEEDS_ESTIMATE: "border-cyan-200 bg-cyan-50 text-cyan-700",
    AWAITING_ESTIMATE: "border-teal-200 bg-teal-50 text-teal-700",
    AWAITING_OWNER: "border-amber-200 bg-amber-50 text-amber-700",
    READY_TO_ASSIGN: "border-sky-200 bg-sky-50 text-sky-700",
    ASSIGNED: "border-violet-200 bg-violet-50 text-violet-700",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
    OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
};

export const recommendationLabels: Record<RequestRecommendation, string> = {
    PROCEED_NOW: "Proceed now",
    GET_ESTIMATE: "Get estimate",
    REQUEST_OWNER_APPROVAL: "Request owner approval",
    PROCEED_AND_NOTIFY: "Proceed and notify owner",
};

export const recommendationStyles: Record<RequestRecommendation, string> = {
    PROCEED_NOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
    GET_ESTIMATE: "border-cyan-200 bg-cyan-50 text-cyan-700",
    REQUEST_OWNER_APPROVAL: "border-amber-200 bg-amber-50 text-amber-700",
    PROCEED_AND_NOTIFY: "border-sky-200 bg-sky-50 text-sky-700",
};

export const policyRouteLabels: Record<RequestPolicyRoute, string> = {
    DIRECT_ASSIGN: "Direct assign",
    EMERGENCY_DISPATCH: "Emergency dispatch",
    NEEDS_ESTIMATE: "Needs estimate",
    OWNER_APPROVAL_REQUIRED: "Owner approval required",
};

export const estimateStatusLabels: Record<RequestEstimateStatus, string> = {
    NOT_REQUESTED: "No estimate",
    REQUESTED: "Estimate requested",
    SUBMITTED: "Estimate submitted",
};

export const estimateStatusStyles: Record<RequestEstimateStatus, string> = {
    NOT_REQUESTED: "border-zinc-200 bg-zinc-100 text-zinc-700",
    REQUESTED: "border-teal-200 bg-teal-50 text-teal-700",
    SUBMITTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const ownerApprovalStatusLabels: Record<OwnerApprovalStatus, string> = {
    NOT_REQUIRED: "Approval not required",
    PENDING: "Owner pending",
    APPROVED: "Owner approved",
    REJECTED: "Owner rejected",
};

export const ownerApprovalStatusStyles: Record<OwnerApprovalStatus, string> = {
    NOT_REQUIRED: "border-zinc-200 bg-zinc-100 text-zinc-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
};

export type RequestWorkflowBucket =
    | "ALL_OPEN"
    | "NEW"
    | "NEEDS_ESTIMATE"
    | "READY_TO_ASSIGN"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "AWAITING_ESTIMATE"
    | "AWAITING_OWNER"
    | "OVERDUE"
    | "CLOSED"
    | "HISTORICAL";

export const workflowBucketLabels: Record<RequestWorkflowBucket, string> = {
    ALL_OPEN: "All Open",
    NEW: "New / Unreviewed",
    NEEDS_ESTIMATE: "Needs Estimate",
    READY_TO_ASSIGN: "Ready to Assign",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    AWAITING_ESTIMATE: "Awaiting Estimate",
    AWAITING_OWNER: "Awaiting Owner",
    OVERDUE: "Overdue",
    CLOSED: "Closed",
    HISTORICAL: "Historical",
};

export const workflowBucketStyles: Record<Exclude<RequestWorkflowBucket, "ALL_OPEN" | "CLOSED" | "HISTORICAL">, string> = {
    NEW: "border-zinc-200 bg-zinc-100 text-zinc-800",
    NEEDS_ESTIMATE: "border-cyan-200 bg-cyan-50 text-cyan-700",
    READY_TO_ASSIGN: "border-sky-200 bg-sky-50 text-sky-700",
    ASSIGNED: "border-violet-200 bg-violet-50 text-violet-700",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
    AWAITING_ESTIMATE: "border-teal-200 bg-teal-50 text-teal-700",
    AWAITING_OWNER: "border-amber-200 bg-amber-50 text-amber-700",
    OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
};

const mapQueueToWorkflowBucket = (queue: RequestQueue): RequestWorkflowBucket => {
    switch (queue) {
        case "NEW":
            return "NEW";
        case "NEEDS_ESTIMATE":
            return "NEEDS_ESTIMATE";
        case "AWAITING_ESTIMATE":
            return "AWAITING_ESTIMATE";
        case "AWAITING_OWNER":
            return "AWAITING_OWNER";
        case "ASSIGNED":
            return "ASSIGNED";
        case "IN_PROGRESS":
            return "IN_PROGRESS";
        case "OVERDUE":
            return "OVERDUE";
        case "READY_TO_ASSIGN":
        default:
            return "READY_TO_ASSIGN";
    }
};

export const getRequestWorkflowBucket = (request: ServiceRequest): RequestWorkflowBucket => {
    if (getRequestTenancyBucket(request.requestTenancyContext) !== "CURRENT") {
        return "HISTORICAL";
    }
    if (isClosedManagementRequest(request)) {
        return "CLOSED";
    }
    if (request.queue === "NEW") {
        return "NEW";
    }
    if (request.queue === "OVERDUE") {
        return "OVERDUE";
    }
    return mapQueueToWorkflowBucket(getPrimaryManagementQueue(request));
};

export const getWorkflowBucketStyle = (bucket: RequestWorkflowBucket) => {
    switch (bucket) {
        case "CLOSED":
            return "border-zinc-200 bg-zinc-100 text-zinc-700";
        case "HISTORICAL":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "ALL_OPEN":
            return "border-zinc-200 bg-zinc-100 text-zinc-700";
        default:
            return workflowBucketStyles[bucket];
    }
};

export const getRequestContextLabel = (request: ServiceRequest) => {
    const tenancyBucket = getRequestTenancyBucket(request.requestTenancyContext);
    if (tenancyBucket === "CURRENT") {
        return getRequestTenancyRowBadgeLabel(request.requestTenancyContext);
    }
    if (tenancyBucket === "HISTORICAL") {
        return "Historical";
    }
    return "Legacy";
};

export const getRequestTargetDate = (request: ServiceRequest) =>
    request.ownerApproval?.deadlineAt ?? request.estimate?.dueAt ?? null;

export const isRequestPastDue = (request: ServiceRequest) => {
    if (request.queue === "OVERDUE") return true;
    const targetDate = getRequestTargetDate(request);
    if (!targetDate || isClosedManagementRequest(request)) return false;
    const timestamp = new Date(targetDate).getTime();
    return !Number.isNaN(timestamp) && timestamp < Date.now();
};

const getDaysPastDueText = (targetDate?: string | null) => {
    if (!targetDate) return "Past target date";
    const timestamp = new Date(targetDate).getTime();
    if (Number.isNaN(timestamp)) return "Past target date";
    const diff = Date.now() - timestamp;
    const days = Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)));
    return `Past target date by ${days} day${days === 1 ? "" : "s"}`;
};

export const getRequestNextAction = (request: ServiceRequest) => {
    const workflow = getRequestWorkflowBucket(request);
    const ownerApprovalStatus = request.ownerApproval?.status ?? request.ownerApprovalStatus ?? "NOT_REQUIRED";
    const estimateStatus = request.estimate?.status ?? "NOT_REQUESTED";
    const targetDate = getRequestTargetDate(request);

    switch (workflow) {
        case "NEW":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "Needs review before routing",
            };
        case "READY_TO_ASSIGN":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "No assignee yet",
            };
        case "ASSIGNED":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "Assigned and waiting to start",
            };
        case "IN_PROGRESS":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "Work is underway",
            };
        case "AWAITING_ESTIMATE":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: estimateStatus === "REQUESTED"
                    ? "Estimate requested from provider"
                    : "Estimate required before assignment",
            };
        case "NEEDS_ESTIMATE":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "Request or submit an estimate",
            };
        case "AWAITING_OWNER":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: estimateStatus === "SUBMITTED" || ownerApprovalStatus === "PENDING"
                    ? "Estimate submitted, approval pending"
                    : "Owner approval pending",
            };
        case "OVERDUE":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: getDaysPastDueText(targetDate),
            };
        case "CLOSED":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: request.status === "cancelled" ? "Request was canceled" : "Request completed",
            };
        case "HISTORICAL":
            return {
                workflow,
                label: workflowBucketLabels[workflow],
                detail: "Outside the current occupancy workflow",
            };
        case "ALL_OPEN":
        default:
            return {
                workflow: "ALL_OPEN" as const,
                label: workflowBucketLabels.ALL_OPEN,
                detail: "Open operational work",
            };
    }
};

export const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
        case "pending":
            return <Clock className="h-4 w-4 text-yellow-500" />;
        case "assigned":
            return <ClipboardList className="h-4 w-4 text-purple-500" />;
        case "in-progress":
            return <AlertCircle className="h-4 w-4 text-blue-500" />;
        case "on-hold":
            return <AlertCircle className="h-4 w-4 text-gray-500" />;
        case "completed":
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case "cancelled":
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
            return <ClipboardList className="h-4 w-4 text-zinc-400" />;
    }
};
