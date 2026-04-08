import type { RequestQueue, ServiceRequest } from "./types";

export const MANAGEMENT_ACTIONABLE_QUEUES = new Set<RequestQueue>([
    "NEEDS_ESTIMATE",
    "AWAITING_ESTIMATE",
    "AWAITING_OWNER",
    "READY_TO_ASSIGN",
]);

export const isClosedManagementRequest = (request: ServiceRequest) =>
    request.status === "completed" || request.status === "cancelled";

export const getPrimaryManagementQueue = (request: ServiceRequest): RequestQueue => {
    if (isClosedManagementRequest(request)) return "READY_TO_ASSIGN";
    if (request.queue && request.queue !== "NEW" && request.queue !== "OVERDUE") {
        return request.queue;
    }
    if ((request.ownerApproval?.status ?? request.ownerApprovalStatus) === "PENDING") return "AWAITING_OWNER";
    if (request.estimate?.status === "REQUESTED") return "AWAITING_ESTIMATE";
    if (request.status === "in-progress") return "IN_PROGRESS";
    if (request.status === "assigned" || request.assignedEmployeeId || request.serviceProvider || request.serviceProviderAssignedTo) return "ASSIGNED";
    if (request.policy?.route === "NEEDS_ESTIMATE") return "NEEDS_ESTIMATE";
    if (request.policy?.route === "OWNER_APPROVAL_REQUIRED") return "AWAITING_OWNER";
    return "READY_TO_ASSIGN";
};

export const isManagementActionableRequest = (request: ServiceRequest) => {
    if (isClosedManagementRequest(request)) return false;
    if (request.queue === "OVERDUE") return true;
    return MANAGEMENT_ACTIONABLE_QUEUES.has(getPrimaryManagementQueue(request));
};
