import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketAuth: { token: string; orgId: string | null } | null = null;

const IS_DEV = process.env.NODE_ENV !== 'production';
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const isAuthSocketError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /(^|\b)(401|403)(\b|$)|unauthorized|forbidden/i.test(message);
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = typeof atob === 'function'
            ? atob(normalized)
            : Buffer.from(normalized, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
};

const getTokenOrgId = (token: string): string | null => {
    const payload = decodeJwtPayload(token);
    const value = payload?.orgId ?? payload?.org_id ?? payload?.organizationId ?? payload?.organization_id ?? null;
    return value ? String(value) : null;
};

const resolveNotificationsUrl = () => {
    const envBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
    if (!envBase) {
        // Never fall back to /api; sockets must target the backend directly.
        throw new Error('Missing NEXT_PUBLIC_WS_BASE_URL (e.g. ws://localhost:3001)');
    }
    const trimmed = trimTrailingSlash(envBase);
    const isWs = /^wss?:\/\//i.test(trimmed);
    const isHttp = /^https?:\/\//i.test(trimmed);
    if (!isWs && !isHttp) {
        throw new Error('NEXT_PUBLIC_WS_BASE_URL must be an absolute http(s) or ws(s) URL');
    }
    const normalizedBase = isWs
        ? trimmed.replace(/^ws(s?):\/\//i, (_, secure) => (secure ? 'https://' : 'http://'))
        : trimmed;
    return `${normalizedBase}/notifications`;
};

export const connectNotificationsSocket = (token: string, orgId?: string | null, options?: { allowTokenOnly?: boolean }) => {
    if (!token) return null;
    const tokenOrgId = getTokenOrgId(token);
    const shouldSendOrgId = !tokenOrgId && Boolean(orgId);
    if (!tokenOrgId && !orgId && !options?.allowTokenOnly) return null;
    const effectiveOrgId = shouldSendOrgId ? String(orgId) : null;
    if (socket && socketAuth?.token === token && socketAuth?.orgId === effectiveOrgId) {
        return socket;
    }
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    const url = resolveNotificationsUrl();
    socketAuth = { token, orgId: effectiveOrgId };
    socket = io(url, {
        auth: effectiveOrgId ? { token, orgId: effectiveOrgId } : { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
    });
    socket.on('connect', () => {
        const transport = socket?.io?.engine?.transport?.name;
        if (transport) {
            console.log(`[WS] connected via ${transport}`);
        }
    });
    socket.on('connect_error', (err) => {
        if (isAuthSocketError(err)) {
            disconnectNotificationsSocket();
            return;
        }
        if (IS_DEV) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn('[WS] connection error', message);
        }
    });
    socket.io?.engine?.on('upgrade', (transport: { name: string }) => {
        console.log(`[WS] transport upgraded to ${transport.name}`);
    });
    return socket;
};

export const disconnectNotificationsSocket = () => {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    socketAuth = null;
};
