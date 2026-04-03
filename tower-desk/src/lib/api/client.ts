import type { User } from '../types';
import { DEBUG_AUTH, logAuth } from '../debugAuth';
import { useAuthStore } from '../auth';
import { deriveAuthStatus } from '../authStorage';
import { API_BASE_URL, AUTH_REQUEST_TIMEOUT_MS, IS_DEV, USE_MOCK } from './config';

const PUBLIC_ENDPOINTS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/health'
];
let refreshPromise: Promise<string | null> | null = null;

type UnauthorizedHandler = (payload: { status: number; endpoint: string; reason?: string }) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let lastUnauthorizedAt = 0;
const UNAUTHORIZED_COOLDOWN_MS = 2000;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    unauthorizedHandler = handler;
}

export function notifyUnauthorized(endpoint: string, status: number, reason?: string) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - lastUnauthorizedAt < UNAUTHORIZED_COOLDOWN_MS) return;
    lastUnauthorizedAt = now;
    unauthorizedHandler?.({ status, endpoint, reason });
}

export const isPublicEndpoint = (endpoint: string) => {
    const normalized = endpoint.toLowerCase();
    return PUBLIC_ENDPOINTS.some((path) => normalized.startsWith(path));
};

const getPermissionSet = (user?: User | null) => {
    const keys = [
        ...(user?.roleKeys ?? []),
        ...(user?.orgRoleKeys ?? []),
        ...(user?.effectivePermissions ?? []),
    ].map((key) => String(key).toLowerCase());
    return new Set(keys);
};

function truncateForLog(value: unknown, max = 800) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

export function createTimeoutController(timeoutMs: number, externalSignal?: AbortSignal) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else {
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }
    return {
        signal: controller.signal,
        cancel: () => clearTimeout(timeoutId)
    };
}

export function resolveAccessToken(primary?: any, fallback?: any): string | null {
    return (
        primary?.accessToken ??
        primary?.access_token ??
        primary?.token ??
        fallback?.accessToken ??
        fallback?.access_token ??
        fallback?.token ??
        null
    );
}

export function resolveRefreshToken(primary?: any, fallback?: any): string | null {
    return (
        primary?.refreshToken ??
        primary?.refresh_token ??
        fallback?.refreshToken ??
        fallback?.refresh_token ??
        null
    );
}

export function buildFriendlyErrorMessage(status: number, errorBody: string, contentType: string | null) {
    const isHtml = Boolean(contentType?.includes('text/html')) || /<\s*(?:!doctype|html|head|body)\b/i.test(errorBody);
    if (isHtml) {
        if (/inactivity timeout/i.test(errorBody)) {
            return 'Request timed out due to inactivity. Please try again.';
        }
        return 'Unexpected server response. Please try again.';
    }
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'Requested resource was not found.';
    if (status >= 500) return 'Server error. Please try again in a moment.';
    return `API Error: ${status}`;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
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
}

async function refreshSession(): Promise<string | null> {
    const { refreshToken, user } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_start', { hasRefreshToken: Boolean(refreshToken), userId: user?.id ?? null });
        }
        let res: Response;
        const { signal, cancel } = createTimeoutController(AUTH_REQUEST_TIMEOUT_MS);
        try {
            res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept': '*/*',
                },
                body: JSON.stringify({ refreshToken }),
                signal
            });
        } catch (e) {
            if (IS_DEV) {
                console.warn('[API] Refresh failed', e);
            }
            if (DEBUG_AUTH) {
                logAuth('AUTH', 'refresh_error', { error: e instanceof Error ? e.message : String(e) });
            }
            return null;
        } finally {
            cancel();
        }
        if (!res.ok) {
            if (DEBUG_AUTH) {
                logAuth('AUTH', `refresh_failed status=${res.status}`);
            }
            return null;
        }
        const data = await res.json();
        const payload = data?.data ?? data;
        const nextAccessToken = resolveAccessToken(payload, data);
        if (!nextAccessToken) return null;
        const nextRefreshToken = resolveRefreshToken(payload, data) ?? refreshToken;
        const incomingUser = payload?.user ?? null;
        const nextUser = incomingUser
            ? {
                ...user,
                ...incomingUser,
                role: incomingUser.role ?? user?.role,
                baseRole: incomingUser.baseRole ?? user?.baseRole,
                roleKeys: Array.isArray(incomingUser.roleKeys) ? incomingUser.roleKeys : user?.roleKeys,
                orgRoleKeys: Array.isArray(incomingUser.orgRoleKeys) ? incomingUser.orgRoleKeys : user?.orgRoleKeys,
                effectivePermissions: Array.isArray(incomingUser.effectivePermissions)
                    ? incomingUser.effectivePermissions
                    : user?.effectivePermissions,
            }
            : user;
        const resolvedUser = nextUser ?? user ?? null;
        const status = deriveAuthStatus({ token: nextAccessToken, user: resolvedUser });
        useAuthStore.setState({
            token: nextAccessToken,
            refreshToken: nextRefreshToken,
            user: resolvedUser,
            status,
            hydrated: true,
            isAuthenticated: status === 'authenticated',
            permissionsReady: status === 'authenticated' && Boolean(resolvedUser)
        });
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_success', { userId: nextUser?.id ?? user?.id ?? null });
        }
        return nextAccessToken;
    } catch (e) {
        if (IS_DEV) {
            console.warn('[API] Refresh failed', e);
        }
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_error', { error: e instanceof Error ? e.message : String(e) });
        }
        return null;
    }
}

export async function refreshSessionSingleFlight(): Promise<string | null> {
    if (refreshPromise) {
        return refreshPromise;
    }
    useAuthStore.setState((state) => ({
        ...state,
        permissionsReady: false,
        status: 'restoring'
    }));
    refreshPromise = (async () => {
        const token = await refreshSession();
        if (token) {
            const { user } = useAuthStore.getState();
            useAuthStore.setState({ permissionsReady: Boolean(user) });
        }
        return token;
    })();
    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

export async function fetchJson(
    endpoint: string,
    options?: RequestInit,
    config?: { retryOnUnauthorized?: boolean; silentStatusCodes?: number[] }
) {
    if (USE_MOCK) return null;
    const retryOnUnauthorized = config?.retryOnUnauthorized ?? true;
    try {
        if (IS_DEV) {
            console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
        }
        const { token, refreshToken, user, selectedOrgId } = useAuthStore.getState();
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
        const isOrgEndpoint = normalizedEndpoint.startsWith('/org/') || normalizedEndpoint.startsWith('/notifications');
        const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
        const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);
        const baseHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'accept': '*/*',
            ...((options?.headers as Record<string, string>) ?? {}),
        };
        if (shouldAttachAuth) {
            baseHeaders.Authorization = `Bearer ${token}`;
        }
        if (shouldAttachOrg) {
            baseHeaders['x-org-id'] = String(activeOrgId);
        }
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: baseHeaders,
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        if (DEBUG_AUTH && (endpoint.startsWith('/auth') || endpoint.startsWith('/users/me') || endpoint.startsWith('/org/users'))) {
            logAuth('API', `${options?.method || 'GET'} ${endpoint} status=${res.status}`);
        }
        if (res.status === 403 && IS_DEV) {
            const payload = token ? decodeJwtPayload(token) : null;
            console.warn("[API] 403 Forbidden", {
                endpoint,
                method: options?.method || 'GET',
                requestUrl: `${API_BASE_URL}${endpoint}`,
                hasToken: Boolean(token),
                hasRefreshToken: Boolean(refreshToken),
                shouldAttachAuth,
                shouldAttachOrg,
                activeOrgId,
                selectedOrgId: selectedOrgId ?? null,
                userId: user?.id ?? null,
                userRole: user?.role ?? null,
                userBaseRole: user?.baseRole ?? null,
                tokenOrgId: payload?.orgId ?? null,
                tokenRole: payload?.role ?? null,
                tokenRoles: payload?.roles ?? null,
                tokenPermissions: payload?.permissions ?? payload?.perms ?? null,
            });
        }
        if (DEBUG_AUTH && res.status >= 400) {
            const payload = token ? decodeJwtPayload(token) : null;
            logAuth('API', `error status=${res.status} ${endpoint}`, {
                method: options?.method || 'GET',
                hasToken: Boolean(token),
                role: user?.role ?? null,
                orgId: selectedOrgId ?? user?.orgId ?? null,
                tokenRole: payload?.role ?? null,
                tokenRoles: payload?.roles ?? null,
                tokenOrgId: payload?.orgId ?? null,
                tokenPermissions: payload?.permissions ?? payload?.perms ?? null,
            });
        }
        if (res.status === 401) {
            const canRefresh = Boolean(refreshToken) && !isPublicEndpoint(endpoint);
            if (retryOnUnauthorized && canRefresh) {
                const refreshed = await refreshSessionSingleFlight();
                if (refreshed) {
                    return fetchJson(endpoint, options, { retryOnUnauthorized: false });
                }
                useAuthStore.getState().logout();
                notifyUnauthorized(endpoint, 401, 'refresh_failed');
            } else if (shouldAttachAuth) {
                useAuthStore.getState().logout();
                notifyUnauthorized(endpoint, 401, 'unauthorized');
            }
        }
        if (!res.ok) {
            let errorBody = '';
            try {
                errorBody = await res.text();
            } catch {
                errorBody = '';
            }
            const silentStatusCodes = config?.silentStatusCodes ?? [];
            const shouldSilence = silentStatusCodes.includes(res.status);
            if (IS_DEV && !shouldSilence) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                if (errorBody) {
                    console.error(`[API] Error Body:`, errorBody);
                }
            }
            if (DEBUG_AUTH && errorBody && !shouldSilence) {
                logAuth('API', `error_body status=${res.status} ${endpoint}`, {
                    body: truncateForLog(errorBody)
                });
            }
            const contentType = res.headers.get('content-type');
            let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
            if (errorBody && /API Error:/i.test(errorMessage)) {
                try {
                    const parsed = JSON.parse(errorBody);
                    const parsedMessage =
                        parsed?.message ??
                        parsed?.error?.message ??
                        parsed?.error?.detail ??
                        parsed?.error?.error ??
                        parsed?.data?.message ??
                        parsed?.data?.error?.message;
                    if (parsedMessage) {
                        errorMessage = parsedMessage;
                    }
                } catch {
                    // Keep the friendly message for non-JSON errors.
                }
            }
            const error = new Error(errorMessage) as Error & { silent?: boolean; status?: number; body?: string };
            error.status = res.status;
            if (errorBody) {
                error.body = errorBody;
            }
            if (IS_DEV && res.status === 403) {
                console.warn("[API] 403 response details", {
                    endpoint,
                    method: options?.method || 'GET',
                    errorMessage,
                    errorBody: truncateForLog(errorBody),
                    contentType,
                });
            }
            if (shouldSilence) {
                error.silent = true;
            }
            throw error;
        }
        if (res.status === 204) {
            if (IS_DEV) {
                console.log(`[API] No content for ${endpoint}`);
            }
            return null;
        }
        const raw = await res.text();
        if (!raw) {
            if (IS_DEV) {
                console.log(`[API] Empty response for ${endpoint}`);
            }
            return null;
        }
        const contentType = res.headers.get('content-type') || '';
        const shouldParseJson = /application\/json/i.test(contentType) || raw.trim().startsWith('{') || raw.trim().startsWith('[');
        const data = shouldParseJson ? JSON.parse(raw) : raw;
        if (IS_DEV) {
            console.log(`[API] Data received for ${endpoint}`);
        }
        return data;
    } catch (e) {
        const error = e as { silent?: boolean };
        if (!error?.silent) {
            console.error("[API] Fetch failed", e);
        }
        throw e;
    }
}

export function redactLoginPayload(payload: any) {
    if (!payload || typeof payload !== 'object') return payload;
    const clone = { ...payload };
    if ('accessToken' in clone) clone.accessToken = '[redacted]';
    if ('access_token' in clone) clone.access_token = '[redacted]';
    if ('token' in clone) clone.token = '[redacted]';
    if ('refreshToken' in clone) clone.refreshToken = '[redacted]';
    if ('refresh_token' in clone) clone.refresh_token = '[redacted]';
    return clone;
}

// Helper to unwrap API response
function getArray(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.items && Array.isArray(res.items)) return res.items;
    if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
    if (res.data && Array.isArray(res.data)) return res.data;
    return [];
}

export type FetchJsonConfig = { retryOnUnauthorized?: boolean; silentStatusCodes?: number[] };

export async function fetchJsonWithFallback(
    primaryEndpoint: string,
    fallbackEndpoint: string,
    options?: RequestInit,
    config?: FetchJsonConfig
) {
    const mergedSilentStatusCodes = Array.from(new Set([...(config?.silentStatusCodes ?? []), 404]));
    const mergedConfig: FetchJsonConfig = {
        ...config,
        silentStatusCodes: mergedSilentStatusCodes,
    };
    try {
        return await fetchJson(primaryEndpoint, options, mergedConfig);
    } catch (error) {
        const status = (error as { status?: unknown })?.status;
        if (status === 404 && fallbackEndpoint && fallbackEndpoint !== primaryEndpoint) {
            return fetchJson(fallbackEndpoint, options, mergedConfig);
        }
        throw error;
    }
}
