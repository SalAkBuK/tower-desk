import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketAuth: { token: string; orgId: string | null } | null = null;

const IS_DEV = process.env.NODE_ENV !== 'production';
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

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
    return `${trimmed}/notifications`;
};

export const connectNotificationsSocket = (token: string, orgId?: string | null) => {
    if (!token || !orgId) return null;
    if (socket && socketAuth?.token === token && socketAuth?.orgId === orgId) {
        return socket;
    }
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    const url = resolveNotificationsUrl();
    socketAuth = { token, orgId };
    socket = io(url, {
        auth: socketAuth,
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
