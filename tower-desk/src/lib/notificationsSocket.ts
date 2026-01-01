import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const stripApiSuffix = (value: string) => {
    if (value.endsWith('/api/proxy')) return value.slice(0, -10);
    if (value.endsWith('/api')) return value.slice(0, -4);
    return value;
};

const resolveBaseUrl = () => {
    const envBase = process.env.NEXT_PUBLIC_WS_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const trimmed = trimTrailingSlash(envBase);
    if (trimmed) {
        if (trimmed.startsWith('/')) {
            return typeof window !== 'undefined' ? window.location.origin : '';
        }
        return stripApiSuffix(trimmed);
    }
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
};

const resolveNotificationsUrl = () => {
    const base = resolveBaseUrl();
    if (!base) return '/notifications';
    return `${base}/notifications`;
};

export const connectNotificationsSocket = (token: string, orgId?: string | null) => {
    if (socket) return socket;
    socket = io(resolveNotificationsUrl(), {
        transports: ['websocket'],
        auth: { token, orgId: orgId ?? null },
    });
    socket.on('connect', () => {
        const transport = socket?.io?.engine?.transport?.name;
        if (transport) {
            console.log(`[WS] connected via ${transport}`);
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
};
