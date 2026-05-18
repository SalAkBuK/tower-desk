import type {
    OwnerApprovalStatus,
    RequestAttachmentUploadPayload,
    RequestAssignee,
    RequestComment,
    RequestCommentVisibility,
    RequestListStatus,
    RequestQueue,
    RequestStatus,
    ServiceProviderMembership,
    ServiceRequest,
} from "../types";
import { useAuthStore } from "../auth";
import { delay, IS_DEV, mockData, USE_MOCK } from "./config";
import { fetchJson } from "./client";
import {
    getArray,
    logDevPayload,
    mapBooleanFlag,
    mapOwnerApprovalStatus,
    mapRequestAttachments,
    mapRequestComment,
    mapRequestCreator,
    mapRequestEstimateStatus,
    mapRequestPolicy,
    mapRequestPriority,
    mapRequestQueue,
    mapRequestTenancyContext,
    mapRequesterContext,
    mapRequestStatus,
    mapRequestStatusToApi,
    mapRequestStatusToApiStatus,
    mapRequestUnit,
} from "./shared";

const asString = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
};

const omitUndefined = <T extends Record<string, unknown>>(value: T) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const mapRequestServiceProvider = (value: any) => {
    if (!value) return null;
    const id = value?.id ?? value?.serviceProviderId ?? value?.providerId;
    if (!id) return null;
    return {
        id: String(id),
        name: value?.name ?? value?.providerName,
        serviceCategory: value?.serviceCategory,
    };
};

const mapAssigneeBuildingAccess = (value: any) => ({
    assignmentId: asString(value?.assignmentId ?? value?.id),
    roleId: asString(value?.roleTemplateId ?? value?.roleId),
    roleTemplateKey: asString(value?.roleTemplateKey ?? value?.roleKey ?? value?.key ?? value?.role) ?? "",
    roleTemplateName: asString(value?.roleTemplateName ?? value?.roleName ?? value?.name),
    scopeType: String(value?.scopeType ?? "BUILDING").toUpperCase() === "ORG" ? "ORG" as const : "BUILDING" as const,
    scopeId: value?.scopeId != null ? String(value.scopeId) : null,
    description: asString(value?.description),
    buildingName: asString(value?.buildingName ?? value?.building?.name),
    permissionKeys: Array.isArray(value?.permissionKeys)
        ? value.permissionKeys.map((entry: unknown) => String(entry)).filter(Boolean)
        : undefined,
});

const mapRequestAssignee = (value: any): RequestAssignee | null => {
    const user = value?.user ?? {};
    const userId = value?.userId ?? value?.id ?? user?.id ?? user?.userId;
    if (!userId) return null;
    return {
        userId: String(userId),
        email: asString(value?.email ?? user?.email),
        name: asString(value?.name ?? value?.fullName ?? user?.name ?? user?.fullName),
        avatarUrl: asString(value?.avatarUrl ?? value?.avatar ?? user?.avatarUrl ?? user?.avatar),
        phone: asString(value?.phone ?? value?.phoneNumber ?? user?.phone ?? user?.phoneNumber),
        isActive: typeof value?.isActive === "boolean"
            ? value.isActive
            : typeof user?.isActive === "boolean"
                ? user.isActive
                : undefined,
        buildingAccess: getArray(value?.buildingAccess)
            .map(mapAssigneeBuildingAccess)
            .filter((entry) => entry.roleTemplateKey && entry.scopeType === "BUILDING" && entry.scopeId),
    };
};

const mapRequestProviderWorker = (value: any) => {
    if (!value) return null;
    const id = value?.id ?? value?.userId ?? value?.workerId ?? value?.serviceProviderAssignedToId;
    if (!id) return null;
    return {
        id: String(id),
        name: value?.name ?? value?.fullName,
        email: value?.email,
    };
};

const mapProviderMembership = (value: any): ServiceProviderMembership | null => {
    const userId = value?.userId ?? value?.id ?? value?.user?.id;
    if (!userId) return null;
    return {
        userId: String(userId),
        email: asString(value?.email ?? value?.user?.email),
        name: asString(value?.name ?? value?.fullName ?? value?.user?.name ?? value?.user?.fullName),
        role: asString(value?.role) ?? "WORKER",
        membershipIsActive: value?.membershipIsActive ?? value?.isActive ?? true,
        userIsActive: typeof value?.userIsActive === "boolean"
            ? value.userIsActive
            : typeof value?.user?.isActive === "boolean"
                ? value.user.isActive
                : undefined,
        mustChangePassword: typeof value?.mustChangePassword === "boolean"
            ? value.mustChangePassword
            : typeof value?.user?.mustChangePassword === "boolean"
                ? value.user.mustChangePassword
                : undefined,
        phone: asString(value?.phone ?? value?.user?.phone),
        tempPassword: asString(value?.tempPassword),
        createdAt: asString(value?.createdAt),
        updatedAt: asString(value?.updatedAt),
    };
};

const mapRequestEstimate = (value: any) => {
    if (!value || typeof value !== "object") return null;
    return {
        status: mapRequestEstimateStatus(value?.status),
        requestedAt: value?.requestedAt ?? null,
        requestedByUserId: value?.requestedByUserId ?? null,
        dueAt: value?.dueAt ?? null,
        reminderSentAt: value?.reminderSentAt ?? null,
        submittedAt: value?.submittedAt ?? null,
        submittedByUserId: value?.submittedByUserId ?? null,
    };
};

const mapRequestOwnerApproval = (value: any) => {
    if (!value || typeof value !== "object") return null;
    return {
        status: mapOwnerApprovalStatus(value?.status),
        requestedAt: value?.requestedAt ?? null,
        requestedByUserId: value?.requestedByUserId ?? null,
        deadlineAt: value?.deadlineAt ?? null,
        decidedAt: value?.decidedAt ?? null,
        decidedByOwnerUserId: value?.decidedByOwnerUserId ?? null,
        reason: value?.reason ?? null,
        requiredReason: value?.requiredReason ?? null,
        estimatedAmount: value?.estimatedAmount != null ? String(value.estimatedAmount) : null,
        estimatedCurrency: value?.estimatedCurrency ?? null,
        decisionSource: value?.decisionSource ?? null,
        overrideReason: value?.overrideReason ?? null,
        overriddenByUserId: value?.overriddenByUserId ?? null,
    };
};

const mapServiceRequest = (requestData: any, raw: any, buildingId?: string): ServiceRequest => {
    const policy = mapRequestPolicy(requestData.policy);
    return {
        id: String(requestData.id ?? raw?.id ?? ""),
        title: requestData.title || "Service Request",
        description: requestData.description || "",
        status: mapRequestStatus(requestData.status),
        priority: mapRequestPriority(requestData.priority),
        buildingId: String(requestData.buildingId || buildingId || ""),
        createdByTenantId: String(requestData.tenantId || requestData.createdByTenantId || requestData.createdByUserId || requestData.createdById || ""),
        createdBy: mapRequestCreator(requestData),
        unit: mapRequestUnit(requestData),
        attachments: mapRequestAttachments(raw),
        createdAt: requestData.createdAt || new Date().toISOString(),
        updatedAt: requestData.updatedAt || new Date().toISOString(),
        assignedEmployeeId: requestData.assignedEmployeeId ?? requestData.assignedTo?.id ?? requestData.assigneeId ?? requestData.assignedStaffId,
        assignedTo: requestData.assignedTo
            ? {
                id: String(requestData.assignedTo.id ?? requestData.assignedTo.userId ?? ""),
                fullName: requestData.assignedTo.fullName ?? requestData.assignedTo.name,
                email: requestData.assignedTo.email,
            }
            : undefined,
        serviceProvider: mapRequestServiceProvider(requestData.serviceProvider),
        serviceProviderAssignedTo: mapRequestProviderWorker(requestData.serviceProviderAssignedTo),
        availableWorkers: getArray(
            requestData.availableWorkers
            ?? requestData.providerUsers
            ?? requestData.workers
            ?? requestData.memberships
            ?? requestData.serviceProvider?.users
            ?? requestData.serviceProvider?.memberships
        )
            .map(mapProviderMembership)
            .filter((entry): entry is ServiceProviderMembership => Boolean(entry))
            .filter((entry) => entry.membershipIsActive !== false && entry.userIsActive !== false),
        estimate: mapRequestEstimate(requestData.estimate),
        ownerApprovalStatus: mapOwnerApprovalStatus(requestData.ownerApprovalStatus ?? requestData.ownerApproval?.status),
        ownerApproval: mapRequestOwnerApproval(requestData.ownerApproval),
        policy,
        isEmergency: policy?.isEmergency ?? mapBooleanFlag(requestData.isEmergency),
        isLikeForLike: policy?.isLikeForLike ?? mapBooleanFlag(requestData.isLikeForLike),
        isUpgrade: policy?.isUpgrade ?? mapBooleanFlag(requestData.isUpgrade),
        isMajorReplacement: policy?.isMajorReplacement ?? mapBooleanFlag(requestData.isMajorReplacement),
        isResponsibilityDisputed: policy?.isResponsibilityDisputed ?? mapBooleanFlag(requestData.isResponsibilityDisputed),
        queue: mapRequestQueue(requestData.queue),
        requesterContext: mapRequesterContext(requestData.requesterContext),
        requestTenancyContext: mapRequestTenancyContext(requestData.requestTenancyContext),
    };
};

const buildRequestListSuffix = (filters?: {
    status?: RequestListStatus;
    ownerApprovalStatus?: OwnerApprovalStatus;
    queue?: RequestQueue | null;
}) => {
    const params = new URLSearchParams();
    if (filters?.status) {
        params.set("status", String(filters.status));
    }
    if (filters?.ownerApprovalStatus) {
        params.set("ownerApprovalStatus", String(filters.ownerApprovalStatus));
    }
    if (filters?.queue) {
        params.set("queue", String(filters.queue));
    }
    const suffix = params.toString();
    return suffix ? `?${suffix}` : "";
};

const filterMockRequests = (
    requests: ServiceRequest[],
    filters?: {
        status?: RequestListStatus;
        ownerApprovalStatus?: OwnerApprovalStatus;
        queue?: RequestQueue | null;
    }
) => requests.filter((request) => {
    if (filters?.status && mapRequestStatus(filters.status) !== request.status) return false;
    if (filters?.ownerApprovalStatus && (request.ownerApprovalStatus ?? "NOT_REQUIRED") !== filters.ownerApprovalStatus) return false;
    if (filters?.queue && request.queue !== filters.queue) return false;
    return true;
});

type RequestWorkflowPayload = {
    estimatedAmount?: number | null;
    estimatedCurrency?: string | null;
    approvalRequiredReason?: string | null;
    isEmergency?: boolean;
    isLikeForLike?: boolean;
    isUpgrade?: boolean;
    isMajorReplacement?: boolean;
    isResponsibilityDisputed?: boolean;
    ownerApprovalDeadlineAt?: string | null;
};

export async function getRequests(
    buildingId?: string,
    filters?: {
        status?: RequestListStatus;
        ownerApprovalStatus?: OwnerApprovalStatus;
        queue?: RequestQueue | null;
    }
): Promise<ServiceRequest[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (!buildingId && role && role !== "superadmin") {
                if (IS_DEV) {
                    console.warn("[API] Skipping getRequests(all) for non-superadmin role");
                }
                return [];
            }
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests${buildRequestListSuffix(filters)}`)
                : await fetchJson("/MaintenanceRequest/all");
            logDevPayload("Management requests payload", res, {
                buildingId: buildingId ?? null,
                filters: filters ?? null,
            });
            return getArray(res).map((entry: any) => {
                const requestData = entry?.request ?? entry?.item ?? entry?.data ?? entry;
                return mapServiceRequest(requestData, entry, buildingId);
            });
        } catch (error) {
            console.warn("Fetch requests failed", error);
        }
    }

    await delay(800);
    const requests = buildingId
        ? mockData.requests.filter((request) => request.buildingId === buildingId)
        : mockData.requests;
    return filterMockRequests(requests, filters);
}

export async function getRequestsForBuildings(
    buildingIds: string[],
    filters?: {
        status?: RequestListStatus;
        ownerApprovalStatus?: OwnerApprovalStatus;
        queue?: RequestQueue | null;
    }
): Promise<ServiceRequest[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            const responses = await Promise.all(
                buildingIds.map(async (id) => {
                    const res = await fetchJson(`/org/buildings/${id}/requests${buildRequestListSuffix(filters)}`).catch(() => []);
                    logDevPayload("Management requests payload", res, {
                        buildingId: id,
                        filters: filters ?? null,
                    });
                    return { id, data: getArray(res) };
                })
            );
            return responses.flatMap(({ id, data }) =>
                data.map((entry: any) => {
                    const requestData = entry?.request ?? entry?.item ?? entry?.data ?? entry;
                    return mapServiceRequest(requestData, entry, id);
                })
            );
        } catch (error) {
            console.warn("Fetch admin requests failed", error);
        }
    }

    await delay(800);
    return filterMockRequests(mockData.requests.filter((request) => buildingIds.includes(request.buildingId)), filters);
}

export async function getRequestAssignees(buildingId: string): Promise<RequestAssignee[]> {
    if (!buildingId) return [];
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/buildings/${buildingId}/requests/assignees`);
            const payload = res?.data ?? res ?? {};
            const assignees: unknown[] = Array.isArray(payload?.assignees)
                ? payload.assignees
                : Array.isArray(payload?.items)
                    ? payload.items
                    : getArray(res);
            logDevPayload("Request assignees payload", res, { buildingId });
            return assignees
                .map((entry) => mapRequestAssignee(entry))
                .filter((entry): entry is RequestAssignee => Boolean(entry))
                .filter((entry) => entry.isActive !== false);
        } catch (error) {
            console.warn("Fetch request assignees failed", error);
        }
    }

    await delay(800);
    return mockData.users
        .filter((user) => (user.baseRole ?? user.role) === "employee" && user.buildingIds?.includes(buildingId))
        .map((user) => ({
            userId: user.id,
            email: user.email,
            name: user.fullName ?? user.name,
            avatarUrl: user.avatarUrl,
            phone: user.phoneNumber,
            isActive: user.isActive,
            buildingAccess: [{
                roleTemplateKey: "building_staff",
                scopeType: "BUILDING",
                scopeId: buildingId,
            }],
        }));
}

export async function getRequest(id: string, buildingId?: string): Promise<ServiceRequest | undefined> {
    if (!USE_MOCK) {
        try {
            let commentsPayload: any = [];
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests/${id}`)
                : await fetchJson(`/MaintenanceRequest/get/${id}`);
            logDevPayload("Management request detail payload", res, {
                requestId: id,
                buildingId: buildingId ?? null,
            });
            if (buildingId) {
                try {
                    commentsPayload = await fetchJson(`/org/buildings/${buildingId}/requests/${id}/comments`);
                } catch (error) {
                    if (IS_DEV) {
                        console.warn("[API] Request comments fetch failed", error);
                    }
                }
            }
            const raw = res?.data ?? res;
            const data = raw?.request ?? raw?.item ?? raw?.data ?? raw;
            if (!data) return undefined;

            const commentsFromDetail: RequestComment[] = Array.isArray(data.comments) ? data.comments.map(mapRequestComment) : [];
            const commentsFromEndpoint: RequestComment[] = getArray(commentsPayload).map(mapRequestComment);
            const commentsMap = new Map<string, RequestComment>();
            commentsFromDetail.forEach((comment) => commentsMap.set(comment.id, comment));
            commentsFromEndpoint.forEach((comment) => commentsMap.set(comment.id, comment));

            return {
                ...mapServiceRequest(data, raw, buildingId),
                completedAt: data.completedAt || null,
                comments: Array.from(commentsMap.values()),
                statusHistory: Array.isArray(data.statusHistory)
                    ? data.statusHistory.map((entry: any) => ({
                        id: String(entry.id),
                        oldStatus: mapRequestStatus(entry.oldStatus),
                        newStatus: mapRequestStatus(entry.newStatus),
                        changedAt: entry.changedAt || new Date().toISOString(),
                        note: entry.note ?? null,
                    }))
                    : [],
            };
        } catch (error) {
            console.warn("Fetch request failed", error);
        }
    }

    const all = await getRequests(buildingId);
    return all.find((request) => request.id === id);
}

export async function createRequest(request: Omit<ServiceRequest, "id" | "createdAt" | "updatedAt">): Promise<ServiceRequest> {
    await delay(800);
    const newRequest: ServiceRequest = {
        ...request,
        id: `r${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    mockData.requests.push(newRequest);
    return newRequest;
}

export async function updateRequestStatus(id: string, status: RequestStatus, note?: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${id}/status`, {
                method: "POST",
                body: JSON.stringify({ status: mapRequestStatusToApiStatus(status) }),
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error("User not authenticated");
            }
            await fetchJson("/MaintenanceRequest/status", {
                method: "POST",
                body: JSON.stringify({
                    requestId: Number(id),
                    newStatus: mapRequestStatusToApi(status),
                    changedById: Number(userId),
                    note: note || "",
                }),
            });
        }
        const updated = await getRequest(id, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === id);
    if (!request) throw new Error("Request not found");
    request.status = status;
    request.updatedAt = new Date().toISOString();
    request.queue = status === "in-progress" ? "IN_PROGRESS" : request.queue;
    return request;
}

export async function cancelRequest(requestId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/cancel`, { method: "POST" });
            const updated = await getRequest(requestId, buildingId);
            if (!updated) throw new Error("Request not found");
            return updated;
        }
        return updateRequestStatus(requestId, "cancelled", undefined, buildingId);
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.status = "cancelled";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function assignRequest(requestId: string, assignedToId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/assign`, {
                method: "POST",
                body: JSON.stringify({ staffUserId: assignedToId }),
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error("User not authenticated");
            }
            await fetchJson("/MaintenanceRequest/assign", {
                method: "POST",
                body: JSON.stringify({
                    requestId: Number(requestId),
                    assignedToId: Number(assignedToId),
                    assignedById: Number(userId),
                }),
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.assignedEmployeeId = assignedToId;
    request.serviceProvider = null;
    request.serviceProviderAssignedTo = null;
    request.status = "assigned";
    request.queue = "ASSIGNED";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function assignRequestProvider(requestId: string, serviceProviderId: string, buildingId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/assign-provider`, {
            method: "POST",
            body: JSON.stringify({ serviceProviderId }),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.assignedEmployeeId = undefined;
    request.serviceProvider = { id: serviceProviderId, name: `Provider ${serviceProviderId}` };
    request.serviceProviderAssignedTo = null;
    request.status = "assigned";
    request.queue = "ASSIGNED";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function assignRequestProviderWorker(requestId: string, userId: string, buildingId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/assign-provider-worker`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.serviceProviderAssignedTo = { id: userId, name: `Worker ${userId}` };
    request.status = "assigned";
    request.queue = "ASSIGNED";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function unassignRequestProvider(requestId: string, buildingId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/unassign-provider`, { method: "POST" });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.serviceProvider = null;
    request.serviceProviderAssignedTo = null;
    request.status = "pending";
    request.queue = "READY_TO_ASSIGN";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function triageRequestPolicy(
    requestId: string,
    buildingId: string,
    payload: {
        estimatedAmount?: number | null;
        estimatedCurrency?: string | null;
        isEmergency: boolean;
        isLikeForLike: boolean;
        isUpgrade: boolean;
        isMajorReplacement: boolean;
        isResponsibilityDisputed: boolean;
    }
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/policy-triage`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");

    const needsApproval = payload.isUpgrade || payload.isMajorReplacement || payload.isResponsibilityDisputed || (payload.estimatedAmount ?? 0) > 1000;
    const needsEstimate = !payload.isEmergency && !payload.isLikeForLike && payload.estimatedAmount == null;

    request.ownerApproval = {
        ...request.ownerApproval,
        estimatedAmount: payload.estimatedAmount != null ? String(payload.estimatedAmount) : null,
        estimatedCurrency: payload.estimatedCurrency ?? null,
    };
    request.policy = {
        ...request.policy,
        route: needsApproval ? "OWNER_APPROVAL_REQUIRED" : needsEstimate ? "NEEDS_ESTIMATE" : payload.isEmergency ? "EMERGENCY_DISPATCH" : "DIRECT_ASSIGN",
        recommendation: needsApproval ? "REQUEST_OWNER_APPROVAL" : needsEstimate ? "GET_ESTIMATE" : payload.isEmergency ? "PROCEED_AND_NOTIFY" : "PROCEED_NOW",
        summary: needsApproval
            ? "Owner approval required before execution."
            : needsEstimate
                ? "Estimate required before dispatch."
                : "Ready for assignment.",
        isEmergency: payload.isEmergency,
        isLikeForLike: payload.isLikeForLike,
        isUpgrade: payload.isUpgrade,
        isMajorReplacement: payload.isMajorReplacement,
        isResponsibilityDisputed: payload.isResponsibilityDisputed,
    };
    request.isEmergency = payload.isEmergency;
    request.isLikeForLike = payload.isLikeForLike;
    request.isUpgrade = payload.isUpgrade;
    request.isMajorReplacement = payload.isMajorReplacement;
    request.isResponsibilityDisputed = payload.isResponsibilityDisputed;
    request.queue = needsApproval ? "AWAITING_OWNER" : needsEstimate ? "NEEDS_ESTIMATE" : "READY_TO_ASSIGN";
    request.ownerApprovalStatus = needsApproval ? "PENDING" : "NOT_REQUIRED";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function requestEstimate(requestId: string, buildingId: string, serviceProviderId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/request-estimate`, {
            method: "POST",
            body: JSON.stringify({ serviceProviderId }),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.assignedEmployeeId = undefined;
    request.serviceProvider = { id: serviceProviderId, name: `Provider ${serviceProviderId}` };
    request.serviceProviderAssignedTo = null;
    request.status = "pending";
    request.queue = "AWAITING_ESTIMATE";
    request.estimate = {
        status: "REQUESTED",
        requestedAt: new Date().toISOString(),
        requestedByUserId: useAuthStore.getState().user?.id ?? null,
        dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        reminderSentAt: null,
        submittedAt: null,
        submittedByUserId: null,
    };
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function submitRequestEstimate(
    requestId: string,
    buildingId: string,
    payload: RequestWorkflowPayload & { estimatedAmount: number }
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/estimate`, {
            method: "POST",
            body: JSON.stringify(omitUndefined({
                estimatedAmount: payload.estimatedAmount,
                estimatedCurrency: payload.estimatedCurrency ?? undefined,
                approvalRequiredReason: payload.approvalRequiredReason ?? undefined,
                isEmergency: payload.isEmergency,
                isLikeForLike: payload.isLikeForLike,
                isUpgrade: payload.isUpgrade,
                isMajorReplacement: payload.isMajorReplacement,
                isResponsibilityDisputed: payload.isResponsibilityDisputed,
                ownerApprovalDeadlineAt: payload.ownerApprovalDeadlineAt ?? undefined,
            })),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");

    const needsApproval = Boolean(
        payload.approvalRequiredReason
        || payload.isUpgrade
        || payload.isMajorReplacement
        || payload.isResponsibilityDisputed
        || payload.estimatedAmount > 1000
    );

    request.ownerApproval = {
        ...request.ownerApproval,
        status: needsApproval ? "PENDING" : "NOT_REQUIRED",
        requestedAt: needsApproval ? new Date().toISOString() : null,
        requestedByUserId: needsApproval ? useAuthStore.getState().user?.id ?? null : null,
        requiredReason: payload.approvalRequiredReason ?? null,
        estimatedAmount: String(payload.estimatedAmount),
        estimatedCurrency: payload.estimatedCurrency ?? null,
    };
    request.ownerApprovalStatus = request.ownerApproval.status;
    request.estimate = {
        ...request.estimate,
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
        submittedByUserId: useAuthStore.getState().user?.id ?? null,
    };
    request.policy = {
        ...request.policy,
        route: needsApproval ? "OWNER_APPROVAL_REQUIRED" : "DIRECT_ASSIGN",
        recommendation: needsApproval ? "REQUEST_OWNER_APPROVAL" : "PROCEED_NOW",
        summary: needsApproval ? "Estimate requires owner approval." : "Estimate approved for assignment.",
        isEmergency: payload.isEmergency ?? request.policy?.isEmergency ?? request.isEmergency ?? null,
        isLikeForLike: payload.isLikeForLike ?? request.policy?.isLikeForLike ?? request.isLikeForLike ?? null,
        isUpgrade: payload.isUpgrade ?? request.policy?.isUpgrade ?? request.isUpgrade ?? null,
        isMajorReplacement: payload.isMajorReplacement ?? request.policy?.isMajorReplacement ?? request.isMajorReplacement ?? null,
        isResponsibilityDisputed: payload.isResponsibilityDisputed ?? request.policy?.isResponsibilityDisputed ?? request.isResponsibilityDisputed ?? null,
    };
    request.queue = needsApproval ? "AWAITING_OWNER" : "READY_TO_ASSIGN";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function requestOwnerApprovalNow(
    requestId: string,
    buildingId: string,
    payload?: RequestWorkflowPayload
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/owner-approval/request-now`, {
            method: "POST",
            body: payload
                ? JSON.stringify(omitUndefined({
                    approvalRequiredReason: payload.approvalRequiredReason ?? undefined,
                    estimatedAmount: payload.estimatedAmount ?? undefined,
                    estimatedCurrency: payload.estimatedCurrency ?? undefined,
                    isEmergency: payload.isEmergency,
                    isLikeForLike: payload.isLikeForLike,
                    isUpgrade: payload.isUpgrade,
                    isMajorReplacement: payload.isMajorReplacement,
                    isResponsibilityDisputed: payload.isResponsibilityDisputed,
                    ownerApprovalDeadlineAt: payload.ownerApprovalDeadlineAt ?? undefined,
                }))
                : undefined,
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.ownerApprovalStatus = "PENDING";
    request.ownerApproval = {
        ...request.ownerApproval,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        requestedByUserId: useAuthStore.getState().user?.id ?? null,
        deadlineAt: payload?.ownerApprovalDeadlineAt ?? null,
        requiredReason: payload?.approvalRequiredReason ?? request.ownerApproval?.requiredReason ?? null,
        estimatedAmount: payload?.estimatedAmount != null ? String(payload.estimatedAmount) : request.ownerApproval?.estimatedAmount ?? null,
        estimatedCurrency: payload?.estimatedCurrency ?? request.ownerApproval?.estimatedCurrency ?? null,
    };
    request.policy = {
        ...request.policy,
        route: "OWNER_APPROVAL_REQUIRED",
        recommendation: "REQUEST_OWNER_APPROVAL",
        summary: request.policy?.summary ?? "Owner approval required before execution.",
        isEmergency: payload?.isEmergency ?? request.policy?.isEmergency ?? request.isEmergency ?? null,
        isLikeForLike: payload?.isLikeForLike ?? request.policy?.isLikeForLike ?? request.isLikeForLike ?? null,
        isUpgrade: payload?.isUpgrade ?? request.policy?.isUpgrade ?? request.isUpgrade ?? null,
        isMajorReplacement: payload?.isMajorReplacement ?? request.policy?.isMajorReplacement ?? request.isMajorReplacement ?? null,
        isResponsibilityDisputed: payload?.isResponsibilityDisputed ?? request.policy?.isResponsibilityDisputed ?? request.isResponsibilityDisputed ?? null,
    };
    request.queue = "AWAITING_OWNER";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function sendOwnerApprovalReminder(requestId: string, buildingId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/owner-approval/resend`, {
            method: "POST",
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(500);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function overrideOwnerApproval(
    requestId: string,
    buildingId: string,
    payload: { decisionSource: string; ownerApprovalOverrideReason: string }
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/owner-approval/override`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.ownerApprovalStatus = "APPROVED";
    request.ownerApproval = {
        ...request.ownerApproval,
        status: "APPROVED",
        decidedAt: new Date().toISOString(),
        decisionSource: payload.decisionSource,
        overrideReason: payload.ownerApprovalOverrideReason,
        overriddenByUserId: useAuthStore.getState().user?.id ?? null,
    };
    request.queue = "READY_TO_ASSIGN";
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function addRequestAttachments(
    requestId: string,
    buildingId: string,
    attachments: RequestAttachmentUploadPayload[]
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/attachments`, {
            method: "POST",
            body: JSON.stringify({ attachments }),
        });
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.attachments = [
        ...(request.attachments ?? []),
        ...attachments.map((entry, index) => ({
            id: `${Date.now()}-${index}`,
            fileName: entry.fileName,
            contentType: entry.mimeType,
            fileUrl: entry.url,
            sizeBytes: entry.sizeBytes,
        })),
    ];
    request.updatedAt = new Date().toISOString();
    return request;
}

export async function addRequestComment(
    requestId: string,
    commentText: string,
    buildingId?: string,
    visibility?: RequestCommentVisibility
): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/comments`, {
                method: "POST",
                body: JSON.stringify(omitUndefined({
                    message: commentText,
                    visibility: asString(visibility),
                })),
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error("User not authenticated");
            }
            await fetchJson("/MaintenanceRequest/comment", {
                method: "POST",
                body: JSON.stringify({
                    requestId: Number(requestId),
                    userId: Number(userId),
                    commentText,
                }),
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) throw new Error("Request not found");
        return updated;
    }

    await delay(800);
    const request = mockData.requests.find((entry) => entry.id === requestId);
    if (!request) throw new Error("Request not found");
    request.comments = [
        ...(request.comments || []),
        {
            id: String(Date.now()),
            commentText,
            createdAt: new Date().toISOString(),
            visibility: visibility ?? "SHARED",
            user: {
                userId: useAuthStore.getState().user?.id || "",
            },
        },
    ];
    request.updatedAt = new Date().toISOString();
    return request;
}
