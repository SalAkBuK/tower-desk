import type { OrgBusinessType, OrgProfile, PlatformOrg, PlatformOrgAdmin } from '../types';
import type {
    CleanupDeliveryTasksBody,
    CleanupDeliveryTasksResponse,
    DeliveryTask,
    DeliveryTaskKind,
    DeliveryTaskListResponse,
    DeliveryTaskStatus,
    DeliveryTaskSummaryResponse,
    ListDeliveryTasksQuery,
    PushDeliveryReceipt,
    PushReceiptSummary,
    RetryDeliveryTaskResponse,
    RetryFailedDeliveryTasksBody,
    RetryFailedDeliveryTasksResponse,
} from "../deliveryTasks";
import { delay, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray } from "./shared";

export async function getPlatformOrgs(): Promise<PlatformOrg[]> {
    const res = await fetchJson('/platform/orgs', { method: 'GET' });
    const data = res?.data ?? res ?? [];
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((org: any) => ({
        id: String(org.id ?? org.orgId ?? ''),
        name: org.name ?? org.orgName ?? 'Organization',
        createdAt: org.createdAt
    }));
}

export async function getPlatformOrgAdmins(): Promise<PlatformOrgAdmin[]> {
    const res = await fetchJson('/platform/org-admins', { method: 'GET' });
    const data = res?.data ?? res ?? [];
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((admin: any) => ({
        id: String(admin.id ?? admin.userId ?? admin.adminId ?? ''),
        email: admin.email ?? admin.user?.email ?? '',
        name: admin.name ?? admin.fullName ?? admin.user?.name ?? admin.user?.fullName,
        orgId: admin.orgId ?? admin.org?.id ?? admin.organizationId ?? null
    }));
}

export async function createPlatformOrg(data: {
    name: string;
    businessName?: string;
    businessType?: OrgBusinessType;
    tradeLicenseNumber?: string;
    vatRegistrationNumber?: string;
    registeredOfficeAddress?: string;
    city?: string;
    officePhoneNumber?: string;
    businessEmailAddress?: string;
    website?: string;
    ownerName?: string;
}): Promise<{ id: string; name: string; createdAt?: string }> {
    const res = await fetchJson('/platform/orgs', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    const body = res?.data ?? res ?? {};
    return {
        id: String(body.id ?? body.orgId ?? ''),
        name: body.name ?? data.name,
        createdAt: body.createdAt
    };
}

export async function getOrgProfile(): Promise<OrgProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/profile');
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.orgId ?? ''),
            name: payload.name ?? payload.orgName ?? '',
            logoUrl: payload.logoUrl ?? payload.logo_url ?? payload.logo,
            businessName: payload.businessName,
            businessType: payload.businessType,
            tradeLicenseNumber: payload.tradeLicenseNumber,
            vatRegistrationNumber: payload.vatRegistrationNumber,
            registeredOfficeAddress: payload.registeredOfficeAddress,
            city: payload.city,
            officePhoneNumber: payload.officePhoneNumber,
            businessEmailAddress: payload.businessEmailAddress,
            website: payload.website,
            ownerName: payload.ownerName
        };
    }
    await delay(800);
    return {
        id: 'org-1',
        name: 'TowerDesk Holdings',
        logoUrl: '',
        businessName: 'TowerDesk Management LLC',
        businessType: 'PROPERTY_MANAGEMENT',
        tradeLicenseNumber: 'TL-12345',
        vatRegistrationNumber: 'VAT-12345',
        registeredOfficeAddress: '123 Main St',
        city: 'Dubai',
        officePhoneNumber: '+971-4-555-0100',
        businessEmailAddress: 'info@towerdesk.com',
        website: 'https://towerdesk.com',
        ownerName: 'Jane Founder'
    };
}

export async function updateOrgProfile(data: {
    name?: string;
    logoUrl?: string;
    businessName?: string;
    businessType?: OrgBusinessType;
    tradeLicenseNumber?: string;
    vatRegistrationNumber?: string;
    registeredOfficeAddress?: string;
    city?: string;
    officePhoneNumber?: string;
    businessEmailAddress?: string;
    website?: string;
    ownerName?: string;
}): Promise<OrgProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/profile', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.orgId ?? ''),
            name: payload.name ?? payload.orgName ?? data.name ?? '',
            logoUrl: payload.logoUrl ?? payload.logo_url ?? data.logoUrl,
            businessName: payload.businessName ?? data.businessName,
            businessType: payload.businessType ?? data.businessType,
            tradeLicenseNumber: payload.tradeLicenseNumber ?? data.tradeLicenseNumber,
            vatRegistrationNumber: payload.vatRegistrationNumber ?? data.vatRegistrationNumber,
            registeredOfficeAddress: payload.registeredOfficeAddress ?? data.registeredOfficeAddress,
            city: payload.city ?? data.city,
            officePhoneNumber: payload.officePhoneNumber ?? data.officePhoneNumber,
            businessEmailAddress: payload.businessEmailAddress ?? data.businessEmailAddress,
            website: payload.website ?? data.website,
            ownerName: payload.ownerName ?? data.ownerName
        };
    }
    await delay(800);
    return {
        id: 'org-1',
        name: data.name ?? 'TowerDesk Holdings',
        logoUrl: data.logoUrl,
        businessName: data.businessName,
        businessType: data.businessType,
        tradeLicenseNumber: data.tradeLicenseNumber,
        vatRegistrationNumber: data.vatRegistrationNumber,
        registeredOfficeAddress: data.registeredOfficeAddress,
        city: data.city,
        officePhoneNumber: data.officePhoneNumber,
        businessEmailAddress: data.businessEmailAddress,
        website: data.website,
        ownerName: data.ownerName
    };
}

export async function createPlatformOrgAdmin(orgId: string, payload: { name: string; email: string; password?: string }) {
    const res = await fetchJson(`/platform/orgs/${orgId}/admins`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const data = res?.data ?? res ?? {};
    return {
        userId: String(data.userId ?? data.id ?? ''),
        email: data.email ?? payload.email,
        tempPassword: data.tempPassword,
        mustChangePassword: data.mustChangePassword ?? true
    };
}

const coerceNullableString = (value: unknown) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

const normalizeDeliveryTaskKind = (value: unknown): DeliveryTaskKind => {
    const normalized = String(value ?? "").trim().toUpperCase();
    switch (normalized) {
        case "AUTH_PASSWORD_EMAIL":
        case "PUSH_NOTIFICATION":
        case "BROADCAST_FANOUT":
            return normalized;
        default:
            return "AUTH_PASSWORD_EMAIL";
    }
};

const normalizeDeliveryTaskStatus = (value: unknown): DeliveryTaskStatus => {
    const normalized = String(value ?? "").trim().toUpperCase();
    switch (normalized) {
        case "QUEUED":
        case "PROCESSING":
        case "SUCCEEDED":
        case "FAILED":
        case "RETRIED":
            return normalized;
        default:
            return "QUEUED";
    }
};

const mapPushReceiptSummary = (value: any): PushReceiptSummary | null => {
    if (!value || typeof value !== "object") return null;
    return {
        total: Number(value.total ?? 0),
        pending: Number(value.pending ?? 0),
        delivered: Number(value.delivered ?? 0),
        error: Number(value.error ?? 0),
        latestCheckedAt: coerceNullableString(value.latestCheckedAt),
    };
};

const mapPushDeliveryReceipt = (value: any): PushDeliveryReceipt => ({
    id: String(value?.id ?? ""),
    provider: String(value?.provider ?? ""),
    platform: String(value?.platform ?? ""),
    status: String(value?.status ?? ""),
    userId: coerceNullableString(value?.userId),
    pushDeviceId: coerceNullableString(value?.pushDeviceId),
    deviceTokenMasked: coerceNullableString(value?.deviceTokenMasked),
    providerTicketId: coerceNullableString(value?.providerTicketId),
    providerReceiptId: coerceNullableString(value?.providerReceiptId),
    errorCode: coerceNullableString(value?.errorCode),
    errorMessage: coerceNullableString(value?.errorMessage),
    details: asRecord(value?.details),
    checkedAt: coerceNullableString(value?.checkedAt),
    createdAt: String(value?.createdAt ?? ""),
    updatedAt: String(value?.updatedAt ?? ""),
});

const mapDeliveryTask = (value: any): DeliveryTask => ({
    id: String(value?.id ?? ""),
    kind: normalizeDeliveryTaskKind(value?.kind),
    status: normalizeDeliveryTaskStatus(value?.status),
    queueName: String(value?.queueName ?? ""),
    jobName: String(value?.jobName ?? ""),
    orgId: coerceNullableString(value?.orgId),
    userId: coerceNullableString(value?.userId),
    referenceType: coerceNullableString(value?.referenceType),
    referenceId: coerceNullableString(value?.referenceId),
    attemptCount: Number(value?.attemptCount ?? 0),
    maxAttempts: Number(value?.maxAttempts ?? 0),
    queuedAt: String(value?.queuedAt ?? ""),
    lastAttemptAt: coerceNullableString(value?.lastAttemptAt),
    processingStartedAt: coerceNullableString(value?.processingStartedAt),
    completedAt: coerceNullableString(value?.completedAt),
    lastError: coerceNullableString(value?.lastError),
    retriedAt: coerceNullableString(value?.retriedAt),
    replacedByTaskId: coerceNullableString(value?.replacedByTaskId),
    payloadSummary: asRecord(value?.payloadSummary) ?? {},
    receiptSummary: mapPushReceiptSummary(value?.receiptSummary),
    providerReceipts: Array.isArray(value?.providerReceipts)
        ? value.providerReceipts.map(mapPushDeliveryReceipt)
        : [],
    createdAt: String(value?.createdAt ?? ""),
    updatedAt: String(value?.updatedAt ?? ""),
});

const buildQueryString = (query?: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, rawValue]) => {
        if (rawValue === undefined || rawValue === null || rawValue === "") return;
        searchParams.set(key, String(rawValue));
    });
    const suffix = searchParams.toString();
    return suffix ? `?${suffix}` : "";
};

export async function listDeliveryTasks(
    query: ListDeliveryTasksQuery = {},
): Promise<DeliveryTaskListResponse> {
    if (USE_MOCK) {
        await delay(200);
        return { items: [], nextCursor: null };
    }

    const res = await fetchJson(`/platform/delivery-tasks${buildQueryString(query)}`, { method: "GET" });
    const payload = res?.data ?? res ?? {};
    const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
    return {
        items: getArray(itemsRaw).map(mapDeliveryTask),
        nextCursor: payload?.nextCursor ?? payload?.data?.nextCursor ?? null,
    };
}

export async function getDeliveryTask(taskId: string): Promise<DeliveryTask> {
    if (USE_MOCK) {
        await delay(200);
        return mapDeliveryTask({ id: taskId });
    }

    const res = await fetchJson(`/platform/delivery-tasks/${taskId}`, { method: "GET" });
    const payload = res?.data ?? res ?? {};
    const item = payload?.data ?? payload;
    return mapDeliveryTask(item);
}

export async function getDeliveryTaskSummary(
    query: Omit<ListDeliveryTasksQuery, "cursor" | "limit"> = {},
): Promise<DeliveryTaskSummaryResponse> {
    if (USE_MOCK) {
        await delay(200);
        return {
            total: 0,
            failedCount: 0,
            oldestFailedAt: null,
            newestFailedAt: null,
            byStatus: [],
            byKind: [],
            topErrors: [],
        };
    }

    const res = await fetchJson(`/platform/delivery-tasks/summary${buildQueryString(query)}`, { method: "GET" });
    const payload = res?.data ?? res ?? {};
    const item = payload?.data ?? payload;

    return {
        total: Number(item?.total ?? 0),
        failedCount: Number(item?.failedCount ?? 0),
        oldestFailedAt: coerceNullableString(item?.oldestFailedAt),
        newestFailedAt: coerceNullableString(item?.newestFailedAt),
        byStatus: Array.isArray(item?.byStatus)
            ? item.byStatus.map((entry: any) => ({
                status: normalizeDeliveryTaskStatus(entry?.status),
                count: Number(entry?.count ?? 0),
            }))
            : [],
        byKind: Array.isArray(item?.byKind)
            ? item.byKind.map((entry: any) => ({
                kind: normalizeDeliveryTaskKind(entry?.kind),
                count: Number(entry?.count ?? 0),
            }))
            : [],
        topErrors: Array.isArray(item?.topErrors)
            ? item.topErrors.map((entry: any) => ({
                kind: normalizeDeliveryTaskKind(entry?.kind),
                lastError: String(entry?.lastError ?? ""),
                count: Number(entry?.count ?? 0),
            }))
            : [],
    };
}

export async function retryDeliveryTask(taskId: string): Promise<RetryDeliveryTaskResponse> {
    const res = await fetchJson(`/platform/delivery-tasks/${taskId}/retry`, { method: "POST" });
    const payload = res?.data ?? res ?? {};
    const item = payload?.data ?? payload;
    return {
        sourceTaskId: String(item?.sourceTaskId ?? taskId),
        task: mapDeliveryTask(item?.task ?? {}),
    };
}

export async function retryFailedDeliveryTasks(
    body: RetryFailedDeliveryTasksBody,
): Promise<RetryFailedDeliveryTasksResponse> {
    const res = await fetchJson("/platform/delivery-tasks/retry-failed", {
        method: "POST",
        body: JSON.stringify(body),
    });
    const payload = res?.data ?? res ?? {};
    const item = payload?.data ?? payload;
    return {
        requested: Number(item?.requested ?? 0),
        retried: Number(item?.retried ?? 0),
        sourceTaskIds: Array.isArray(item?.sourceTaskIds) ? item.sourceTaskIds.map((entry: unknown) => String(entry)) : [],
        replacementTaskIds: Array.isArray(item?.replacementTaskIds) ? item.replacementTaskIds.map((entry: unknown) => String(entry)) : [],
    };
}

export async function cleanupDeliveryTasks(
    body: CleanupDeliveryTasksBody,
): Promise<CleanupDeliveryTasksResponse> {
    const res = await fetchJson("/platform/delivery-tasks/cleanup", {
        method: "POST",
        body: JSON.stringify(body),
    });
    const payload = res?.data ?? res ?? {};
    const item = payload?.data ?? payload;
    return {
        count: Number(item?.count ?? 0),
        olderThan: String(item?.olderThan ?? ""),
        olderThanDays: Number(item?.olderThanDays ?? body.olderThanDays ?? 30),
        statuses: Array.isArray(item?.statuses)
            ? item.statuses.map((entry: unknown) => normalizeDeliveryTaskStatus(entry))
            : [],
        dryRun: Boolean(item?.dryRun),
    };
}
