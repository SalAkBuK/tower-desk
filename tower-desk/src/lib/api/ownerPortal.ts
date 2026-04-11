import type {
    Conversation,
    ConversationListResponse,
    ConversationMessage,
    NotificationItem,
    OwnerPortfolioSummary,
    OwnerPortfolioUnit,
    RequestComment,
    ServiceRequest,
} from "../types";
import { fetchJson } from "./client";
import { delay, USE_MOCK } from "./config";
import {
    getArray,
    logDevPayload,
    mapConversation,
    mapConversationMessage,
    mapNotification,
    mapRequestAttachments,
    mapRequestComment,
    mapRequestCreator,
    mapRequestPriority,
    mapRequestTenancyContext,
    mapRequesterContext,
    mapRequestStatus,
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

const mapOwnerApproval = (value: any) => {
    if (!value || typeof value !== "object") return null;
    return {
        status: asString(value.status),
        requestedAt: value.requestedAt ?? null,
        requestedByUserId: asNullableString(value.requestedByUserId),
        deadlineAt: value.deadlineAt ?? null,
        decidedAt: value.decidedAt ?? null,
        decidedByOwnerUserId: asNullableString(value.decidedByOwnerUserId),
        reason: asNullableString(value.reason),
        requiredReason: asNullableString(value.requiredReason),
        estimatedAmount: value.estimatedAmount != null ? String(value.estimatedAmount) : null,
        estimatedCurrency: asNullableString(value.estimatedCurrency),
        decisionSource: asNullableString(value.decisionSource),
        overrideReason: asNullableString(value.overrideReason),
        overriddenByUserId: asNullableString(value.overriddenByUserId),
    };
};

const mapOwnerRequest = (value: any): ServiceRequest => {
    const request = value?.request ?? value?.item ?? value?.data ?? value ?? {};
    return {
        id: String(request.id ?? ""),
        orgId: asString(request.orgId),
        orgName: asString(request.orgName ?? request.org?.name),
        title: request.title ?? "Service Request",
        description: request.description ?? "",
        status: mapRequestStatus(request.status),
        priority: mapRequestPriority(request.priority),
        type: asString(request.type),
        buildingId: String(request.buildingId ?? ""),
        buildingName: asString(request.buildingName ?? request.building?.name),
        createdByTenantId: String(request.createdByTenantId ?? request.createdByUserId ?? request.createdById ?? ""),
        createdBy: mapRequestCreator(request),
        assignedEmployeeId: asString(request.assignedTo?.id ?? request.assigneeId ?? request.assignedEmployeeId),
        assignedTo: request.assignedTo
            ? {
                id: String(request.assignedTo.id ?? ""),
                fullName: asString(request.assignedTo.fullName ?? request.assignedTo.name),
                email: asString(request.assignedTo.email),
            }
            : undefined,
        unit: mapRequestUnit(request),
        attachments: mapRequestAttachments(value),
        requesterContext: mapRequesterContext(request.requesterContext),
        requestTenancyContext: mapRequestTenancyContext(request.requestTenancyContext),
        ownerApproval: mapOwnerApproval(request.ownerApproval),
        comments: Array.isArray(request.comments) ? request.comments.map(mapRequestComment) : undefined,
        createdAt: request.createdAt ?? new Date().toISOString(),
        updatedAt: request.updatedAt ?? new Date().toISOString(),
        completedAt: request.completedAt ?? null,
        statusHistory: Array.isArray(request.statusHistory)
            ? request.statusHistory.map((entry: any) => ({
                id: String(entry.id ?? ""),
                oldStatus: mapRequestStatus(entry.oldStatus),
                newStatus: mapRequestStatus(entry.newStatus),
                changedAt: entry.changedAt ?? new Date().toISOString(),
                note: entry.note ?? null,
            }))
            : [],
    };
};

const mapOwnerPortfolioSummary = (value: any): OwnerPortfolioSummary => ({
    unitCount: Number(value?.unitCount ?? 0),
    orgCount: Number(value?.orgCount ?? 0),
    buildingCount: Number(value?.buildingCount ?? 0),
});

const mapOwnerPortfolioUnit = (value: any): OwnerPortfolioUnit => ({
    orgId: String(value?.orgId ?? ""),
    orgName: asString(value?.orgName),
    ownerId: String(value?.ownerId ?? ""),
    unitId: String(value?.unitId ?? ""),
    buildingId: String(value?.buildingId ?? ""),
    buildingName: asString(value?.buildingName),
    unitLabel: asString(value?.unitLabel ?? value?.unit?.label),
});

export async function getOwnerPortfolioSummary(): Promise<OwnerPortfolioSummary> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/portfolio/summary");
        return mapOwnerPortfolioSummary(res?.data ?? res ?? {});
    }

    await delay(200);
    return { unitCount: 0, orgCount: 0, buildingCount: 0 };
}

export async function getOwnerPortfolioUnits(): Promise<OwnerPortfolioUnit[]> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/portfolio/units");
        return getArray(res).map(mapOwnerPortfolioUnit).filter((unit) => unit.unitId);
    }

    await delay(200);
    return [];
}

export async function getOwnerPortfolioRequests(): Promise<ServiceRequest[]> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/portfolio/requests");
        logDevPayload("Owner portfolio requests payload", res);
        return getArray(res).map(mapOwnerRequest).filter((request) => request.id);
    }

    await delay(200);
    return [];
}

export async function getOwnerPortfolioRequest(requestId: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/portfolio/requests/${requestId}`);
        logDevPayload("Owner portfolio request detail payload", res, { requestId });
        return mapOwnerRequest(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapOwnerRequest({ id: requestId });
}

export async function getOwnerRequestCommentUnreadCount(): Promise<number> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/portfolio/requests/comments/unread-count");
        const body = res?.data ?? res ?? {};
        return Number(body.unreadCount ?? body.count ?? 0);
    }

    await delay(100);
    return 0;
}

export async function approveOwnerRequest(requestId: string, payload?: { approvalReason?: string }) {
    if (!USE_MOCK) {
        await fetchJson(`/owner/portfolio/requests/${requestId}/approve`, {
            method: "POST",
            body: JSON.stringify(payload?.approvalReason ? { approvalReason: payload.approvalReason } : {}),
        });
        return getOwnerPortfolioRequest(requestId);
    }

    await delay(200);
    return getOwnerPortfolioRequest(requestId);
}

export async function rejectOwnerRequest(requestId: string, payload: { approvalReason: string }) {
    if (!USE_MOCK) {
        await fetchJson(`/owner/portfolio/requests/${requestId}/reject`, {
            method: "POST",
            body: JSON.stringify({ approvalReason: payload.approvalReason }),
        });
        return getOwnerPortfolioRequest(requestId);
    }

    await delay(200);
    return getOwnerPortfolioRequest(requestId);
}

export async function getOwnerRequestComments(requestId: string): Promise<RequestComment[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/portfolio/requests/${requestId}/comments`);
        return getArray(res).map(mapRequestComment);
    }

    await delay(200);
    return [];
}

export async function addOwnerRequestComment(requestId: string, payload: { message: string }): Promise<RequestComment> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/portfolio/requests/${requestId}/comments`, {
            method: "POST",
            body: JSON.stringify({ message: payload.message }),
        });
        return mapRequestComment(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapRequestComment({
        id: `owner-comment-${Date.now()}`,
        message: payload.message,
        createdAt: new Date().toISOString(),
    });
}

export async function createOwnerManagementConversation(payload: { unitId: string; subject: string; message: string }): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/messages/management", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return mapConversation(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapConversation({
        id: `owner-conversation-${Date.now()}`,
        subject: payload.subject,
        messages: [{ id: `owner-message-${Date.now()}`, content: payload.message, createdAt: new Date().toISOString() }],
    });
}

export async function createOwnerTenantConversation(payload: { unitId: string; tenantUserId: string; subject: string; message: string }): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/messages/tenants", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return mapConversation(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapConversation({
        id: `owner-conversation-${Date.now()}`,
        subject: payload.subject,
        messages: [{ id: `owner-message-${Date.now()}`, content: payload.message, createdAt: new Date().toISOString() }],
    });
}

export async function getOwnerConversations(params?: { limit?: number; cursor?: string }): Promise<ConversationListResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.cursor) query.set("cursor", params.cursor);
        const suffix = query.toString();
        const res = await fetchJson(`/owner/conversations${suffix ? `?${suffix}` : ""}`);
        const payload = res?.data ?? res ?? {};
        const items = getArray(payload?.items ?? payload).map(mapConversation);
        const nextCursor = payload?.nextCursor ?? null;
        return { items, nextCursor };
    }

    await delay(200);
    return { items: [], nextCursor: null };
}

export async function getOwnerConversationUnreadCount(): Promise<number> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/conversations/unread-count");
        const body = res?.data ?? res ?? {};
        return Number(body.unreadCount ?? body.count ?? 0);
    }

    await delay(100);
    return 0;
}

export async function getOwnerConversationById(conversationId: string): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/conversations/${conversationId}`);
        return mapConversation(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapConversation({ id: conversationId });
}

export async function sendOwnerConversationMessage(conversationId: string, payload: { content: string }): Promise<ConversationMessage> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/conversations/${conversationId}/messages`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return mapConversationMessage(res?.data ?? res ?? {});
    }

    await delay(200);
    return mapConversationMessage({
        id: `owner-message-${Date.now()}`,
        content: payload.content,
        createdAt: new Date().toISOString(),
    });
}

export async function markOwnerConversationRead(conversationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/conversations/${conversationId}/read`, {
            method: "POST",
        });
        return res?.data ?? res ?? { success: true };
    }

    await delay(100);
    return { success: true };
}

export async function getOwnerNotifications(params?: {
    unreadOnly?: boolean;
    includeDismissed?: boolean;
    type?: string;
    limit?: number;
    cursor?: string;
}): Promise<{ items: NotificationItem[]; nextCursor?: string | null }> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (typeof params?.unreadOnly === "boolean") query.set("unreadOnly", String(params.unreadOnly));
        if (typeof params?.includeDismissed === "boolean") query.set("includeDismissed", String(params.includeDismissed));
        if (params?.type) query.set("type", params.type);
        if (params?.limit) query.set("limit", String(params.limit));
        if (params?.cursor) query.set("cursor", params.cursor);
        const suffix = query.toString();
        const res = await fetchJson(`/owner/notifications${suffix ? `?${suffix}` : ""}`);
        const payload = res?.data ?? res ?? {};
        const items = getArray(payload?.items ?? payload).map(mapNotification);
        const nextCursor = payload?.nextCursor ?? null;
        return { items, nextCursor };
    }

    await delay(200);
    return { items: [], nextCursor: null };
}

export async function getOwnerNotificationUnreadCount(): Promise<number> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/notifications/unread-count");
        const body = res?.data ?? res ?? {};
        return Number(body.unreadCount ?? body.count ?? 0);
    }

    await delay(100);
    return 0;
}

export async function markOwnerNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/notifications/${notificationId}/read`, { method: "POST" });
        return res?.data ?? res ?? { success: true };
    }

    await delay(100);
    return { success: true };
}

export async function markAllOwnerNotificationsRead(): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson("/owner/notifications/read-all", { method: "POST" });
        return res?.data ?? res ?? { success: true };
    }

    await delay(100);
    return { success: true };
}

export async function dismissOwnerNotification(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/notifications/${notificationId}/dismiss`, { method: "POST" });
        return res?.data ?? res ?? { success: true };
    }

    await delay(100);
    return { success: true };
}

export async function undismissOwnerNotification(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/owner/notifications/${notificationId}/undismiss`, { method: "POST" });
        return res?.data ?? res ?? { success: true };
    }

    await delay(100);
    return { success: true };
}
