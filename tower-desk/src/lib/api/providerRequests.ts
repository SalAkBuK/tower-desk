import type {
    RequestAttachmentUploadPayload,
    RequestComment,
    RequestStatus,
    ServiceProviderMembership,
    ServiceRequest,
} from "../types";
import { fetchJson } from "./client";
import { delay, USE_MOCK } from "./config";
import {
    getArray,
    mapRequestAttachments,
    mapRequestComment,
    mapRequestCreator,
    mapRequestPriority,
    mapRequestStatus,
    mapRequestStatusToApiStatus,
    mapRequestUnit,
} from "./shared";

const asString = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
};

const asNullableString = (value: unknown) => {
    if (value === null) return null;
    return asString(value);
};

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

const mapServiceProviderWorker = (value: any) => {
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

const mapProviderRequest = (value: any): ServiceRequest => {
    const request = value?.request ?? value?.item ?? value?.data ?? value ?? {};
    const comments = Array.isArray(request.comments) ? request.comments.map(mapRequestComment) : undefined;
    const availableWorkers = getArray(
        request.availableWorkers
        ?? request.providerUsers
        ?? request.workers
        ?? request.memberships
        ?? request.serviceProvider?.users
        ?? request.serviceProvider?.memberships
    )
        .map(mapProviderMembership)
        .filter((entry): entry is ServiceProviderMembership => Boolean(entry))
        .filter((entry) => entry.membershipIsActive !== false && entry.userIsActive !== false);

    return {
        id: String(request.id ?? ""),
        title: request.title ?? "Service Request",
        description: request.description ?? "",
        status: mapRequestStatus(request.status),
        priority: mapRequestPriority(request.priority),
        buildingId: String(request.buildingId ?? ""),
        buildingName: asString(request.buildingName ?? request.building?.name),
        createdByTenantId: String(request.tenantId ?? request.createdByTenantId ?? request.createdByUserId ?? request.createdById ?? ""),
        type: asString(request.type),
        createdBy: mapRequestCreator(request),
        unit: mapRequestUnit(request),
        createdAt: request.createdAt ?? new Date().toISOString(),
        updatedAt: request.updatedAt ?? new Date().toISOString(),
        completedAt: request.completedAt ?? null,
        serviceProvider: mapRequestServiceProvider(request.serviceProvider),
        serviceProviderAssignedTo: mapServiceProviderWorker(request.serviceProviderAssignedTo),
        availableWorkers,
        attachments: mapRequestAttachments(value),
        comments,
        ownerApproval: request?.ownerApproval
            ? {
                status: asString(request.ownerApproval.status),
                requestedAt: request.ownerApproval.requestedAt ?? null,
                requestedByUserId: asNullableString(request.ownerApproval.requestedByUserId),
                deadlineAt: request.ownerApproval.deadlineAt ?? null,
                decidedAt: request.ownerApproval.decidedAt ?? null,
                decidedByOwnerUserId: asNullableString(request.ownerApproval.decidedByOwnerUserId),
                reason: asNullableString(request.ownerApproval.reason),
                requiredReason: asNullableString(request.ownerApproval.requiredReason),
                estimatedAmount: request.ownerApproval.estimatedAmount != null ? String(request.ownerApproval.estimatedAmount) : null,
                estimatedCurrency: asNullableString(request.ownerApproval.estimatedCurrency),
                decisionSource: asNullableString(request.ownerApproval.decisionSource),
                overrideReason: asNullableString(request.ownerApproval.overrideReason),
                overriddenByUserId: asNullableString(request.ownerApproval.overriddenByUserId),
            }
            : null,
        statusHistory: Array.isArray(request.statusHistory)
            ? request.statusHistory.map((entry: any) => ({
                id: String(entry.id),
                oldStatus: mapRequestStatus(entry.oldStatus),
                newStatus: mapRequestStatus(entry.newStatus),
                changedAt: entry.changedAt ?? new Date().toISOString(),
                note: entry.note ?? null,
            }))
            : [],
    };
};

const getProviderRequestCommentsFromPayload = (value: any): RequestComment[] => {
    return getArray(value).map(mapRequestComment);
};

export async function getProviderRequests(options?: { status?: RequestStatus | "all"; serviceProviderId?: string }) {
    if (!USE_MOCK) {
        const params = new URLSearchParams();
        if (options?.status && options.status !== "all") {
            params.set("status", mapRequestStatusToApiStatus(options.status));
        }
        if (options?.serviceProviderId) {
            params.set("serviceProviderId", options.serviceProviderId);
        }
        const suffix = params.size > 0 ? `?${params.toString()}` : "";
        const res = await fetchJson(`/provider/requests${suffix}`);
        return getArray(res).map(mapProviderRequest).filter((request) => request.id);
    }

    await delay(800);
    return [];
}

export async function getProviderRequestUnreadCount() {
    if (!USE_MOCK) {
        const res = await fetchJson("/provider/requests/comments/unread-count");
        const body = res?.data ?? res ?? {};
        return Number(body.unreadCount ?? body.count ?? 0);
    }

    await delay(200);
    return 0;
}

export async function getProviderRequest(requestId: string) {
    if (!USE_MOCK) {
        const res = await fetchJson(`/provider/requests/${requestId}`);
        return mapProviderRequest(res?.data ?? res);
    }

    await delay(300);
    return mapProviderRequest({ id: requestId });
}

export async function getProviderRequestComments(requestId: string) {
    if (!USE_MOCK) {
        const res = await fetchJson(`/provider/requests/${requestId}/comments`);
        return getProviderRequestCommentsFromPayload(res?.data ?? res);
    }

    await delay(300);
    return [];
}

export async function assignProviderRequestWorker(requestId: string, userId: string) {
    if (!USE_MOCK) {
        await fetchJson(`/provider/requests/${requestId}/assign-worker`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
        return getProviderRequest(requestId);
    }

    await delay(300);
    return mapProviderRequest({
        id: requestId,
        serviceProviderAssignedTo: { id: userId, name: "Assigned Worker" },
    });
}

export async function updateProviderRequestStatus(requestId: string, status: Extract<RequestStatus, "in-progress" | "completed">) {
    if (!USE_MOCK) {
        await fetchJson(`/provider/requests/${requestId}/status`, {
            method: "POST",
            body: JSON.stringify({ status: mapRequestStatusToApiStatus(status) }),
        });
        return getProviderRequest(requestId);
    }

    await delay(300);
    return mapProviderRequest({ id: requestId, status });
}

export async function addProviderRequestComment(requestId: string, message: string) {
    if (!USE_MOCK) {
        await fetchJson(`/provider/requests/${requestId}/comments`, {
            method: "POST",
            body: JSON.stringify({ message }),
        });
        return getProviderRequestComments(requestId);
    }

    await delay(300);
    return [
        mapRequestComment({
            id: String(Date.now()),
            message,
            visibility: "SHARED",
            createdAt: new Date().toISOString(),
        }),
    ];
}

export async function addProviderRequestAttachments(requestId: string, attachments: RequestAttachmentUploadPayload[]) {
    if (!USE_MOCK) {
        await fetchJson(`/provider/requests/${requestId}/attachments`, {
            method: "POST",
            body: JSON.stringify({ attachments }),
        });
        return getProviderRequest(requestId);
    }

    await delay(300);
    return mapProviderRequest({
        id: requestId,
        attachments: attachments.map((entry, index) => ({
            id: `${index + 1}`,
            fileName: entry.fileName,
            contentType: entry.mimeType,
            fileUrl: entry.url,
            sizeBytes: entry.sizeBytes,
        })),
    });
}
