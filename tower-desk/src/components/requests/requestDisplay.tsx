"use client";

import { AlertCircle, CheckCircle2, ClipboardList, Clock } from "lucide-react";

import { RequestPriority, RequestStatus } from "@/lib/types";

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
