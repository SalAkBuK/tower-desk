import type { RequestQueue, ServiceRequest } from "./types";
import { isCurrentRequestTenancyContext } from "./requestTenancyContext";

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
    const ownerApprovalStatus = request.ownerApproval?.status ?? request.ownerApprovalStatus;
    if (ownerApprovalStatus === "PENDING" || ownerApprovalStatus === "REJECTED") return "AWAITING_OWNER";
    if (request.estimate?.status === "REQUESTED") return "AWAITING_ESTIMATE";
    if (request.status === "in-progress") return "IN_PROGRESS";
    if (request.status === "assigned" || request.assignedEmployeeId || request.serviceProvider || request.serviceProviderAssignedTo) return "ASSIGNED";
    if (request.queue && request.queue !== "NEW" && request.queue !== "OVERDUE" && request.queue !== "AWAITING_OWNER") {
        return request.queue;
    }
    if (request.queue === "AWAITING_OWNER" && (ownerApprovalStatus === "PENDING" || ownerApprovalStatus === "REJECTED")) return "AWAITING_OWNER";
    if (ownerApprovalStatus === "APPROVED") return "READY_TO_ASSIGN";
    if (request.policy?.route === "NEEDS_ESTIMATE") return "NEEDS_ESTIMATE";
    return "READY_TO_ASSIGN";
};

export const isNewManagementRequest = (request: ServiceRequest) => {
    if (isClosedManagementRequest(request)) return false;
    if (request.queue === "NEW") return true;
    const primaryQueue = getPrimaryManagementQueue(request);
    return primaryQueue === "READY_TO_ASSIGN" || primaryQueue === "NEEDS_ESTIMATE";
};

export const isManagementActionableRequest = (request: ServiceRequest) => {
    if (isClosedManagementRequest(request)) return false;
    if (!isCurrentRequestTenancyContext(request.requestTenancyContext)) return false;
    if (request.queue === "OVERDUE") return true;
    return MANAGEMENT_ACTIONABLE_QUEUES.has(getPrimaryManagementQueue(request));
};
