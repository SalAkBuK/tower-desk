export const DEBUG_AUTH = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export function getClientTraceId(): string {
    if (typeof document === 'undefined') return 'server';
    const match = document.cookie.match(/(?:^|;\s*)td_trace_id=([^;]+)/);
    return match?.[1] ?? 'no-trace';
}

type LogMeta = Record<string, unknown> | undefined;

export function logAuth(_scope: string, _message: string, _meta?: LogMeta) {
    return;
}
