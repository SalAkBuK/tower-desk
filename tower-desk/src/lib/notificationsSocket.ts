import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveNotificationsUrl = () => {
    const envBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
    if (!envBase) {
        // Never fall back to /api; sockets must target the backend directly.
        throw new Error('Missing NEXT_PUBLIC_WS_BASE_URL (e.g. ws://localhost:3001)');
    }
    const trimmed = trimTrailingSlash(envBase);
    if (!/^wss?:\/\//i.test(trimmed)) {
        throw new Error('NEXT_PUBLIC_WS_BASE_URL must be an absolute ws(s) URL');
    }
    return `${trimmed}/notifications`;
};

export const connectNotificationsSocket = (token: string, orgId?: string | null) => {
    if (socket) return socket;
    const url = resolveNotificationsUrl();
    if (!url) {
        return null;
    }
    socket = io(url, {
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
