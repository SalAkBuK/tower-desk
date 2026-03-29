import type { NotificationItem } from '../types';
import { useAuthStore } from '../auth';
import { delay, IS_DEV, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray, mapNotification } from './shared';

export async function getNotifications(params?: { unreadOnly?: boolean; cursor?: string; limit?: number }): Promise<{ items: NotificationItem[]; nextCursor?: string | null }> {
    if (!USE_MOCK) {
        const { token, user, selectedOrgId } = useAuthStore.getState();
        const role = user?.baseRole ?? user?.role;
        const orgId = selectedOrgId ?? user?.orgId ?? null;
        if (!token || role === 'superadmin' || !orgId) {
            if (IS_DEV) {
                console.warn('[API] Skipping getNotifications due to missing org context');
            }
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
        const res = await fetchJson(`/notifications${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapNotification);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/notifications/${notificationId}/read`, { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/notifications/read-all', { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}
