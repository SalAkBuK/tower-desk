import type { RequestComment, RequestStatus, ServiceRequest } from '../types';
import { useAuthStore } from '../auth';
import { delay, IS_DEV, mockData, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray, mapRequestAttachments, mapRequestComment, mapRequestCreator, mapRequestPriority, mapRequestStatus, mapRequestStatusToApi, mapRequestStatusToApiStatus, mapRequestUnit } from './shared';

export async function getRequests(buildingId?: string): Promise<ServiceRequest[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (!buildingId && role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getRequests(all) for non-superadmin role');
                }
                return [];
            }
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests`)
                : await fetchJson('/MaintenanceRequest/all');
            const data = getArray(res);
            return data.map((r: any) => {
                const requestData = r?.request ?? r?.item ?? r?.data ?? r;
                    return {
                        id: String(requestData.id ?? r.id),
                        title: requestData.title || 'Service Request',
                        description: requestData.description || '',
                        status: mapRequestStatus(requestData.status),
                        priority: mapRequestPriority(requestData.priority),
                        buildingId: String(requestData.buildingId || buildingId || ''),
                        createdByTenantId: String(requestData.tenantId || requestData.createdByTenantId || requestData.createdByUserId || requestData.createdById || ''),
                        createdBy: mapRequestCreator(requestData),
                        unit: mapRequestUnit(requestData),
                        attachments: mapRequestAttachments(r),
                        createdAt: requestData.createdAt || new Date().toISOString(),
                        updatedAt: requestData.updatedAt || new Date().toISOString(),
                        assignedEmployeeId: requestData.assignedEmployeeId ?? requestData.assignedTo?.id ?? requestData.assigneeId ?? requestData.assignedStaffId,
                    assignedTo: requestData.assignedTo
                        ? {
                            id: String(requestData.assignedTo.id ?? requestData.assignedTo.userId ?? ''),
                            fullName: requestData.assignedTo.fullName ?? requestData.assignedTo.name,
                            email: requestData.assignedTo.email
                        }
                        : undefined
                };
            });
        } catch (e) { console.warn("Fetch requests failed", e) }
    }

    await delay(800);
    if (buildingId) {
        return mockData.requests.filter((r) => r.buildingId === buildingId);
    }
    return mockData.requests;
}

export async function getRequestsForBuildings(buildingIds: string[]): Promise<ServiceRequest[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            const responses = await Promise.all(
                buildingIds.map(async (id) => {
                    const res = await fetchJson(`/org/buildings/${id}/requests`).catch(() => []);
                    return { id, data: getArray(res) };
                })
            );
            return responses.flatMap(({ id, data }) =>
                data.map((r: any) => {
                    const requestData = r?.request ?? r?.item ?? r?.data ?? r;
                    return {
                        id: String(requestData.id ?? r.id),
                        title: requestData.title || 'Service Request',
                        description: requestData.description || '',
                        status: mapRequestStatus(requestData.status),
                        priority: mapRequestPriority(requestData.priority),
                        buildingId: String(requestData.buildingId || id),
                        createdByTenantId: String(requestData.tenantId || requestData.createdByTenantId || requestData.createdByUserId || requestData.createdById || ''),
                        createdBy: mapRequestCreator(requestData),
                        unit: mapRequestUnit(requestData),
                        attachments: mapRequestAttachments(r),
                        createdAt: requestData.createdAt || new Date().toISOString(),
                        updatedAt: requestData.updatedAt || new Date().toISOString(),
                        assignedEmployeeId: requestData.assignedEmployeeId ?? requestData.assignedTo?.id ?? requestData.assigneeId ?? requestData.assignedStaffId,
                        assignedTo: requestData.assignedTo
                            ? {
                                id: String(requestData.assignedTo.id ?? requestData.assignedTo.userId ?? ''),
                                fullName: requestData.assignedTo.fullName ?? requestData.assignedTo.name,
                                email: requestData.assignedTo.email
                            }
                            : undefined
                    };
                })
            );
        } catch (e) {
            console.warn("Fetch admin requests failed", e);
        }
    }
    await delay(800);
    return mockData.requests.filter((req) => buildingIds.includes(req.buildingId));
}

export async function getRequest(id: string, buildingId?: string): Promise<ServiceRequest | undefined> {
    if (!USE_MOCK) {
        try {
            let commentsPayload: any = [];
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests/${id}`)
                : await fetchJson(`/MaintenanceRequest/get/${id}`);
            if (buildingId) {
                try {
                    commentsPayload = await fetchJson(`/org/buildings/${buildingId}/requests/${id}/comments`);
                } catch (e) {
                    if (IS_DEV) {
                        console.warn("[API] Request comments fetch failed", e);
                    }
                }
            }
            const raw = res?.data ?? res;
            const data = raw?.request ?? raw?.item ?? raw?.data ?? raw;
            if (!data) return undefined;
            const commentsFromDetail: RequestComment[] = Array.isArray(data.comments)
                ? data.comments.map(mapRequestComment)
                : [];
            const commentsFromEndpoint: RequestComment[] = getArray(commentsPayload).map(mapRequestComment);
            const commentsMap = new Map<string, RequestComment>();
            commentsFromDetail.forEach((comment) => commentsMap.set(comment.id, comment));
            commentsFromEndpoint.forEach((comment) => commentsMap.set(comment.id, comment));
            return {
                id: String(data.id),
                title: data.title || 'Service Request',
                description: data.description || '',
                status: mapRequestStatus(data.status),
                priority: mapRequestPriority(data.priority),
                buildingId: String(data.buildingId || buildingId || ''),
                createdByTenantId: String(data.tenantId || data.createdByTenantId || data.createdByUserId || data.createdById || ''),
                createdBy: mapRequestCreator(data),
                unit: mapRequestUnit(data),
                assignedEmployeeId: data.assignedEmployeeId ?? data.assignedTo?.id ?? data.assigneeId ?? data.assignedStaffId,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                completedAt: data.completedAt || null,
                assignedTo: data.assignedTo
                    ? {
                        id: String(data.assignedTo.id),
                        fullName: data.assignedTo.fullName,
                        email: data.assignedTo.email
                    }
                    : undefined,
                comments: Array.from(commentsMap.values()),
                attachments: mapRequestAttachments(raw),
                statusHistory: Array.isArray(data.statusHistory)
                    ? data.statusHistory.map((entry: any) => ({
                        id: String(entry.id),
                        oldStatus: mapRequestStatus(entry.oldStatus),
                        newStatus: mapRequestStatus(entry.newStatus),
                        changedAt: entry.changedAt || new Date().toISOString(),
                        note: entry.note ?? null
                    }))
                    : []
            };
        } catch (e) {
            console.warn("Fetch request failed", e);
        }
    }
    const all = await getRequests(buildingId);
    return all.find((r) => r.id === id);
}

export async function createRequest(request: Omit<ServiceRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequest> {
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
                method: 'POST',
                body: JSON.stringify({
                    status: mapRequestStatusToApiStatus(status)
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/status', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(id),
                    newStatus: mapRequestStatusToApi(status),
                    changedById: Number(userId),
                    note: note || ''
                })
            });
        }
        const updated = await getRequest(id, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(800);
    const req = mockData.requests.find((r) => r.id === id);
    if (!req) throw new Error('Request not found');
    req.status = status;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function cancelRequest(requestId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/cancel`, {
                method: 'POST'
            });
            const updated = await getRequest(requestId, buildingId);
            if (!updated) {
                throw new Error('Request not found');
            }
            return updated;
        }
        return updateRequestStatus(requestId, 'cancelled', undefined, buildingId);
    }

    await delay(800);
    const req = mockData.requests.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    req.status = 'cancelled';
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function assignRequest(requestId: string, assignedToId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    staffUserId: assignedToId
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/assign', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(requestId),
                    assignedToId: Number(assignedToId),
                    assignedById: Number(userId)
                })
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(800);
    const req = mockData.requests.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    req.assignedEmployeeId = assignedToId;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function addRequestComment(requestId: string, commentText: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    message: commentText
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/comment', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(requestId),
                    userId: Number(userId),
                    commentText
                })
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(800);
    const req = mockData.requests.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    const newComment = {
        id: String(Date.now()),
        commentText,
        createdAt: new Date().toISOString(),
        user: { userId: useAuthStore.getState().user?.id || '' }
    };
    req.comments = [...(req.comments || []), newComment];
    req.updatedAt = new Date().toISOString();
    return req;
}
