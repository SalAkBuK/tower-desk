import type { NotificationItem } from '../types';
import { useAuthStore } from '../auth';
import { delay, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray, mapNotification } from './shared';

const isForbiddenError = (error: unknown) => {
    const status = (error as { status?: unknown })?.status;
    return status === 403;
};

export async function getNotifications(params?: { unreadOnly?: boolean; cursor?: string; limit?: number }): Promise<{ items: NotificationItem[]; nextCursor?: string | null }> {
    if (!USE_MOCK) {
        const { token, user, selectedOrgId } = useAuthStore.getState();
        const role = user?.baseRole ?? user?.role;
        const orgId = selectedOrgId ?? user?.orgId ?? null;
        if (!token || role === 'superadmin' || !orgId) {
            return { items: [], nextCursor: null };
        }
        const query = new URLSearchParams();
        if (params?.unreadOnly) {
            query.set('unreadOnly', 'true');
        }
        if (params?.cursor) {
            query.set('cursor', params.cursor);
        }
        if (params?.limit) {
            query.set('limit', String(params.limit));
        }
        const suffix = query.toString();
        try {
            const res = await fetchJson(
                `/notifications${suffix ? `?${suffix}` : ''}`,
                undefined,
                { silentStatusCodes: [403] }
            );
            const payload = res?.data ?? res ?? {};
            const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
            const items = getArray(itemsRaw).map(mapNotification);
            const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
            return { items, nextCursor };
        } catch (error) {
            if (isForbiddenError(error)) {
                return { items: [], nextCursor: null };
            }
            throw error;
        }
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                `/notifications/${notificationId}/read`,
                { method: 'POST' },
                { silentStatusCodes: [403] }
            );
            return res?.data ?? res ?? { success: true };
        } catch (error) {
            if (isForbiddenError(error)) {
                return { success: false };
            }
            throw error;
        }
    }
    await delay(800);
    return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                '/notifications/read-all',
                { method: 'POST' },
                { silentStatusCodes: [403] }
            );
            return res?.data ?? res ?? { success: true };
        } catch (error) {
            if (isForbiddenError(error)) {
                return { success: false };
            }
            throw error;
        }
    }
    await delay(800);
    return { success: true };
}
