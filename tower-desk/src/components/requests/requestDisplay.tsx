"use client";

import { AlertCircle, CheckCircle2, ClipboardList, Clock } from "lucide-react";

import {
    OwnerApprovalStatus,
    RequestEstimateStatus,
    RequestPolicyRoute,
    RequestPriority,
    RequestQueue,
    RequestRecommendation,
    RequestStatus,
} from "@/lib/types";

export const priorityStyles: Record<RequestPriority, string> = {
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
};

export const statusStyles: Record<RequestStatus, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    assigned: "bg-purple-50 text-purple-700 border-purple-200",
    "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
    "on-hold": "bg-gray-100 text-gray-700 border-gray-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
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
    NEW: "bg-slate-100 text-slate-700 border-slate-200",
    NEEDS_ESTIMATE: "bg-cyan-50 text-cyan-700 border-cyan-200",
    AWAITING_ESTIMATE: "bg-teal-50 text-teal-700 border-teal-200",
    AWAITING_OWNER: "bg-amber-50 text-amber-700 border-amber-200",
    READY_TO_ASSIGN: "bg-sky-50 text-sky-700 border-sky-200",
    ASSIGNED: "bg-violet-50 text-violet-700 border-violet-200",
    IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
    OVERDUE: "bg-rose-50 text-rose-700 border-rose-200",
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
    NOT_REQUIRED: "No owner approval",
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
