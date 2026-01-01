import { NextRequest, NextResponse } from 'next/server';

const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true' || process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

function generateTraceId() {
    try {
        return crypto.randomUUID();
    } catch {
        return Math.random().toString(36).slice(2, 10);
    }
}

export function middleware(req: NextRequest) {
    const existingTrace = req.cookies.get('td_trace_id')?.value;
    const traceId = existingTrace || generateTraceId();
    const res = NextResponse.next();

    res.headers.set('x-trace-id', traceId);
    if (!existingTrace) {
        res.cookies.set('td_trace_id', traceId, {
            path: '/',
            sameSite: 'lax',
        });
    }

    if (DEBUG_AUTH) {
        const authHeader = req.headers.get('authorization');
        const orgHeader = req.headers.get('x-org-id');
        const tokenSuffix = authHeader?.slice(-6);
        const cookieKeys = req.cookies.getAll().map((cookie) => cookie.name);
        console.log(
            `[AUTH][MW][${traceId}] path=${req.nextUrl.pathname} method=${req.method} decision=ALLOW authHeader=${Boolean(authHeader)} tokenSuffix=${tokenSuffix ?? 'none'} orgHeader=${orgHeader ?? 'none'} cookies=${cookieKeys.join(',')}`
        );
    }

    return res;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
