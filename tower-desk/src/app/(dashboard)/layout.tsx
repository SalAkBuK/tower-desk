"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { logAuth } from "@/lib/debugAuth";
import { canAccessPortalRole } from "@/lib/roles";
import { resolvePortalRouteFromPath } from "@/lib/portalRoute";
import { normalizeToPortalPath } from "@/lib/portalPaths";
import { logPortalEvent } from "@/lib/portalTelemetry";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, role, baseRole, status, logout, permissionsReady } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);
    const lastRedirectRef = useRef<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (status === 'unknown' || status === 'restoring') return;
        if (status === 'unauthenticated') {
            logAuth('GUARD', `client redirect /login from=${pathname} status=${status}`);
            router.replace('/login');
            return;
        }
        if (status === 'authenticated' && user && !role) {
            logAuth('GUARD', `client redirect /login missing role from=${pathname}`);
            logout();
            router.replace('/login');
            return;
        }
        if (status !== 'authenticated' || !user || !role) return;
        if (!permissionsReady) return;
        if (!canAccessPortalRole(baseRole)) {
            logAuth('GUARD', `client redirect /login blocked portal role=${baseRole ?? 'none'} from=${pathname}`, {
                userId: user?.id ?? null,
                orgId: user?.orgId ?? null
            });
            logout();
            router.replace('/login?reason=mobile-app-only');
            return;
        }
        if (pathname === '/login' || pathname === '/403') return;
        const query = searchParams?.toString();
        const normalizedPathname = normalizeToPortalPath(pathname);
        const normalizedDestination = query ? `${normalizedPathname}?${query}` : normalizedPathname;
        if ((pathname.startsWith('/sa') || pathname.startsWith('/platform')) && baseRole !== 'superadmin') {
            logAuth('GUARD', `client redirect /403 from=${pathname} required=superadmin role=${role}`, {
                orgId: user?.orgId ?? null,
                userId: user?.id ?? null
            });
            if (lastRedirectRef.current !== `/403:${pathname}`) {
                router.replace('/403');
                lastRedirectRef.current = `/403:${pathname}`;
            }
            return;
        }
        if (pathname.startsWith('/sa') && baseRole === 'superadmin') {
            const nextPath = pathname.replace(/^\/sa\b/, '/platform');
            if (lastRedirectRef.current !== nextPath) {
                router.replace(nextPath);
                lastRedirectRef.current = nextPath;
            }
            return;
        }
        if ((pathname.startsWith('/admin') || pathname.startsWith('/manager')) && baseRole !== 'superadmin') {
            logPortalEvent('legacy_route_redirect', {
                from: pathname,
                to: normalizedDestination,
                role: baseRole ?? null,
                userId: user?.id ?? null,
            });
            if (lastRedirectRef.current !== normalizedDestination) {
                router.replace(normalizedDestination);
                lastRedirectRef.current = normalizedDestination;
            }
            return;
        }
        if (pathname.startsWith('/portal') && baseRole !== 'superadmin') {
            const resolution = resolvePortalRouteFromPath({ pathname, user, baseRole });
            if (resolution?.destination === '/403') {
                logPortalEvent('portal_guard_forbidden', {
                    from: pathname,
                    reason: resolution.reason,
                    segment: resolution.segment ?? null,
                    role: baseRole ?? null,
                    userId: user?.id ?? null,
                });
                if (lastRedirectRef.current !== `/403:${pathname}`) {
                    router.replace('/403');
                    lastRedirectRef.current = `/403:${pathname}`;
                }
            }
        }
    }, [mounted, pathname, router, searchParams, user, role, baseRole, status, permissionsReady, logout]);

    // Prevent flash of content
    if (!mounted || status === 'unknown') {
        return null;
    }

    if (status === 'restoring') {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return <AppLayout>{children}</AppLayout>;
}
