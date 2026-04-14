"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DEBUG_AUTH, logAuth } from "@/lib/debugAuth";
import { getCurrentUser, refreshAuth } from "@/lib/api/auth";
import { setUnauthorizedHandler } from "@/lib/api/client";

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => {
        const isProd = process.env.NODE_ENV === "production";
        let lastAuthToastAt = 0;
        const shouldToastAuthError = (error: unknown) => {
            const err = error as { status?: number; silent?: boolean; message?: string };
            if (err?.silent) return false;
            if (err?.status !== 401) return false;
            const now = Date.now();
            if (now - lastAuthToastAt < 3000) return false;
            lastAuthToastAt = now;
            return true;
        };
        const handleAuthError = (error: unknown) => {
            if (shouldToastAuthError(error)) {
                const message = (error as Error)?.message || "Your session expired. Please sign in again.";
                toast.error(message);
            }
        };
        return new QueryClient({
            queryCache: new QueryCache({
                onError: handleAuthError,
            }),
            mutationCache: new MutationCache({
                onError: handleAuthError,
            }),
            defaultOptions: {
                queries: {
                    refetchOnWindowFocus: true,
                    staleTime: isProd ? 30_000 : 0,
                },
            },
        });
    });
    useAccessCatalogCacheReset(queryClient);
    useSessionRestore();
    useUnauthorizedRedirect();
    useNavigationLogger();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster />
        </QueryClientProvider>
    );
}

function useAccessCatalogCacheReset(queryClient: QueryClient) {
    const { user, baseRole, selectedOrgId } = useAuth();
    const previousContextRef = useRef<string | null>(null);

    useEffect(() => {
        const nextContext = [
            user?.id ?? "anonymous",
            baseRole ?? "none",
            selectedOrgId ?? user?.orgId ?? "no-org",
        ].join(":");

        if (previousContextRef.current === null) {
            previousContextRef.current = nextContext;
            return;
        }

        if (previousContextRef.current === nextContext) {
            return;
        }

        previousContextRef.current = nextContext;
        queryClient.removeQueries({ queryKey: ["permissions"] });
        queryClient.removeQueries({ queryKey: ["roles"] });
        queryClient.removeQueries({ queryKey: ["role-templates"] });
        queryClient.removeQueries({ queryKey: ["user-roles", "me"] });
    }, [baseRole, queryClient, selectedOrgId, user?.id, user?.orgId]);
}

const RESTORE_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_AUTH_RESTORE_TIMEOUT_MS ?? 12_000);
const REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS ?? 8_000);
const MAX_RESTORE_ATTEMPTS = 1;
const SENSITIVE_QUERY_KEYS = new Set(['token', 'access_token', 'refresh_token', 'id_token', 'code']);

const isPublicPath = (pathname?: string | null) =>
    pathname === '/login'
    || pathname === '/forgot-password'
    || pathname === '/reset-password'
    || pathname === '/onboarding/set-password'
    || Boolean(pathname?.startsWith('/onboarding/'))
    || Boolean(pathname?.startsWith('/auth'));

function useSessionRestore() {
    const { status, token, refreshToken, login, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const lastRestoreKeyRef = useRef<string | null>(null);
    const attemptRef = useRef(0);
    const redirectingRef = useRef(false);

    useEffect(() => {
        if (status !== 'restoring') {
            lastRestoreKeyRef.current = null;
            attemptRef.current = 0;
            return;
        }

        const restoreKey = `${token ?? ''}:${refreshToken ?? ''}`;
        if (lastRestoreKeyRef.current !== restoreKey) {
            lastRestoreKeyRef.current = restoreKey;
            attemptRef.current = 0;
        }

        if (attemptRef.current >= MAX_RESTORE_ATTEMPTS) {
            if (DEBUG_AUTH) {
                logAuth('AUTH', 'restore_blocked', { reason: 'max_attempts' });
            }
            logout();
            if (!isPublicPath(pathname)) {
                router.replace('/login');
            }
            return;
        }

        attemptRef.current += 1;
        let cancelled = false;

        const redirectToLogin = () => {
            if (redirectingRef.current) return;
            redirectingRef.current = true;
            if (!isPublicPath(pathname)) {
                router.replace('/login');
            }
            setTimeout(() => {
                redirectingRef.current = false;
            }, 500);
        };

        const timeoutId = setTimeout(() => {
            if (cancelled) return;
            cancelled = true;
            if (DEBUG_AUTH) {
                logAuth('AUTH', 'restore_timeout', {
                    hasToken: Boolean(token),
                    hasRefreshToken: Boolean(refreshToken)
                });
            }
            logout();
            redirectToLogin();
        }, RESTORE_TIMEOUT_MS);

        const restore = async () => {
            try {
                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'restore_start', {
                        hasToken: Boolean(token),
                        hasRefreshToken: Boolean(refreshToken)
                    });
                }

                let nextUser = null;
                let nextToken = token ?? null;
                let nextRefreshToken = refreshToken ?? null;

                if (refreshToken) {
                    const refreshed = await refreshAuth(refreshToken);
                    if (refreshed?.token) nextToken = refreshed.token;
                    if (refreshed?.refreshToken) nextRefreshToken = refreshed.refreshToken;
                    if (refreshed?.user) nextUser = refreshed.user;
                }

                const needsPermissions = nextUser
                    ? !((nextUser.roleKeys?.length ?? 0) || (nextUser.orgRoleKeys?.length ?? 0) || (nextUser.effectivePermissions?.length ?? 0))
                    : false;
                if ((!nextUser || needsPermissions) && nextToken) {
                    const hydrated = await getCurrentUser(nextToken, {
                        timeoutMs: REQUEST_TIMEOUT_MS,
                        rolesTimeoutMs: REQUEST_TIMEOUT_MS
                    });
                    if (hydrated) {
                        nextUser = hydrated;
                    }
                }

                if (cancelled) return;

                if (nextUser) {
                    login(nextUser, nextToken, nextRefreshToken);
                    if (DEBUG_AUTH) {
                        logAuth('AUTH', 'restore_success', { userId: nextUser?.id ?? null });
                    }
                    clearTimeout(timeoutId);
                    return;
                }

                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'restore_failed', {
                        hasToken: Boolean(token),
                        hasRefreshToken: Boolean(refreshToken)
                    });
                }
                logout();
                redirectToLogin();
            } catch (e) {
                if (cancelled) return;
                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'restore_error', { error: e instanceof Error ? e.message : String(e) });
                }
                logout();
                redirectToLogin();
            } finally {
                clearTimeout(timeoutId);
            }
        };

        restore();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [status, token, refreshToken, login, logout, router, pathname]);
}

function useUnauthorizedRedirect() {
    const { logout, status } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const redirectingRef = useRef(false);

    useEffect(() => {
        const handler = () => {
            if (redirectingRef.current) return;
            redirectingRef.current = true;
            if (status !== 'unauthenticated') {
                logout();
            }
            if (!isPublicPath(pathname)) {
                router.replace('/login');
            }
            setTimeout(() => {
                redirectingRef.current = false;
            }, 500);
        };

        setUnauthorizedHandler(handler);
        return () => {
            setUnauthorizedHandler(null);
        };
    }, [logout, router, pathname, status]);
}

function useNavigationLogger() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { role, user, selectedOrgId, selectedBuildingId, status } = useAuth();
    const previousRef = useRef<string | null>(null);

    useEffect(() => {
        if (!DEBUG_AUTH) return;
        const query = searchParams
            ? new URLSearchParams(
                Array.from(searchParams.entries()).map(([key, value]) => (
                    SENSITIVE_QUERY_KEYS.has(key.toLowerCase())
                        ? [key, '[redacted]']
                        : [key, value]
                ))
            ).toString()
            : '';
        const next = query ? `${pathname}?${query}` : pathname;
        const from = previousRef.current ?? 'entry';
        logAuth('NAV', `from=${from} to=${next}`, {
            role: role ?? 'none',
            orgId: selectedOrgId ?? user?.orgId ?? null,
            buildingId: selectedBuildingId ?? null,
            status,
            userId: user?.id ?? null
        });
        previousRef.current = next;
    }, [pathname, searchParams, role, selectedOrgId, selectedBuildingId, status, user?.id, user?.orgId]);
}
