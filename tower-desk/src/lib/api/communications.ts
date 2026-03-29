import type { Broadcast, BroadcastListResponse, Conversation, ConversationListResponse, ConversationMessage, CreateBroadcastInput, CreateConversationInput } from '../types';
import { delay, USE_MOCK } from './config';
import { fetchJson } from './client';
import { getArray, mapBroadcast, mapConversation, mapConversationMessage } from './shared';

// =====================
// Broadcasts
// =====================

export async function createBroadcast(data: CreateBroadcastInput): Promise<Broadcast> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/broadcasts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapBroadcast(item);
    }
    await delay(800);
    return {
        id: `broadcast-${Date.now()}`,
        title: data.title,
        body: data.body,
        buildingIds: data.buildingIds ?? [],
        recipientCount: 0,
        sender: { id: 'mock', name: 'Mock User', email: 'mock@example.com' },
        createdAt: new Date().toISOString(),
    };
}

export async function getBroadcasts(params?: { limit?: number; cursor?: string; buildingId?: string }): Promise<BroadcastListResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.cursor) query.set('cursor', params.cursor);
        if (params?.buildingId) query.set('buildingId', params.buildingId);
        const suffix = query.toString();
        const res = await fetchJson(`/org/broadcasts${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapBroadcast);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function getBroadcastById(id: string): Promise<Broadcast> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/broadcasts/${id}`);
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapBroadcast(item);
    }
    await delay(800);
    return {
        id,
        title: 'Mock Broadcast',
        body: 'This is a mock broadcast.',
        buildingIds: [],
        recipientCount: 0,
        sender: { id: 'mock', name: 'Mock User', email: 'mock@example.com' },
        createdAt: new Date().toISOString(),
    };
}

// =====================
// Conversations
// =====================

export async function createConversation(data: CreateConversationInput): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/conversations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversation(item);
    }
    await delay(800);
    return {
        id: `conversation-${Date.now()}`,
        subject: data.subject ?? null,
        buildingId: data.buildingId ?? null,
        participants: data.participantUserIds.map((id) => ({ id })),
        unreadCount: 0,
        lastMessage: {
            id: `msg-${Date.now()}`,
            content: data.message,
            sender: { id: 'mock', name: 'Mock User', avatarUrl: null },
            createdAt: new Date().toISOString(),
        },
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export async function getConversations(params?: { limit?: number; cursor?: string }): Promise<ConversationListResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.cursor) query.set('cursor', params.cursor);
        const suffix = query.toString();
        const res = await fetchJson(`/org/conversations${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapConversation);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(800);
    return { items: [], nextCursor: null };
}

export async function getConversationById(id: string): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${id}`);
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversation(item);
    }
    await delay(800);
    return {
        id,
        subject: 'Mock Conversation',
        buildingId: null,
        participants: [],
        unreadCount: 0,
        lastMessage: null,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export async function sendConversationMessage(conversationId: string, data: { content: string }): Promise<ConversationMessage> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversationMessage(item);
    }
    await delay(800);
    return {
        id: `msg-${Date.now()}`,
        content: data.content,
        sender: { id: 'mock', name: 'Mock User', avatarUrl: null },
        createdAt: new Date().toISOString(),
    };
}

export async function markConversationRead(conversationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${conversationId}/read`, { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}
