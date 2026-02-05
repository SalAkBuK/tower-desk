"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { logAuth } from "@/lib/debugAuth";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, role, baseRole, status, logout, permissionsReady } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const lastRedirectRef = useRef<string | null>(null);
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user?.effectivePermissions, user?.roleKeys, user?.orgRoleKeys]);
    const routeRules = useMemo(
        () => ([
            { prefix: "/admin/requests", rule: { prefixes: ["requests"] } },
            { prefix: "/manager/requests", rule: { prefixes: ["requests"] } },
            { prefix: "/admin/units", rule: { prefixes: ["units", "buildings"] } },
            { prefix: "/manager/units", rule: { prefixes: ["units", "buildings"] } },
            { prefix: "/admin/residents", rule: { prefixes: ["residents"] } },
            { prefix: "/manager/residents", rule: { prefixes: ["residents"] } },
            { prefix: "/admin/occupancy", rule: { prefixes: ["occupancy"] } },
            { prefix: "/manager/occupancy", rule: { prefixes: ["occupancy"] } },
            { prefix: "/admin/parking", rule: { prefixes: ["parkingSlots", "parkingAllocations", "vehicles"] } },
            { prefix: "/manager/parking", rule: { prefixes: ["parkingSlots", "parkingAllocations", "vehicles"] } },
            { prefix: "/admin/visitors", rule: { prefixes: ["visitors"] } },
            { prefix: "/manager/visitors", rule: { prefixes: ["visitors"] } },
            // { prefix: "/admin/owners", rule: { prefixes: ["owners"] } },
            // { prefix: "/manager/owners", rule: { prefixes: ["owners"] } },
            { prefix: "/admin/reports", rule: { prefixes: ["reports"] } },
            { prefix: "/manager/reports", rule: { prefixes: ["reports"] } },
            { prefix: "/admin/buildings", rule: { prefixes: ["buildings"] } },
            { prefix: "/manager/buildings", rule: { prefixes: ["buildings"] } },
            { prefix: "/admin/users", rule: { prefixes: ["users"] } },
            { prefix: "/manager/users", rule: { prefixes: ["users"] } },
            { prefix: "/admin/permissions", rule: { prefixes: ["roles"] } },
            { prefix: "/manager/permissions", rule: { prefixes: ["roles"] } },
            { prefix: "/admin/access", rule: { prefixes: ["roles", "users", "building.assignments"] } },
            { prefix: "/manager/access", rule: { prefixes: ["roles", "users", "building.assignments"] } },
        ]),
        []
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (status === 'loading' || status === 'restoring') return;
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
        if (pathname === '/login' || pathname === '/403') return;
        if (pathname.startsWith('/sa') && baseRole !== 'superadmin') {
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
        if (pathname.startsWith('/admin') || pathname.startsWith('/manager')) {
            // Superadmin has access to all admin/manager routes
            if (baseRole === 'superadmin') return;

            const match = routeRules.find((entry) => pathname.startsWith(entry.prefix));
            if (match && !hasAnyPermission(permissionSet, match.rule)) {
                logAuth('GUARD', `client redirect /403 from=${pathname} missing_permissions role=${role}`, {
                    orgId: user?.orgId ?? null,
                    userId: user?.id ?? null,
                    rule: match.rule
                });
                if (lastRedirectRef.current !== `/403:${pathname}`) {
                    router.replace('/403');
                    lastRedirectRef.current = `/403:${pathname}`;
                }
                return;
            }
        }
    }, [mounted, pathname, router, user, role, baseRole, status, permissionsReady, permissionSet, routeRules]);

    // Prevent flash of content
    if (
        !mounted
        || status === 'loading'
        || status === 'restoring'
        || (status === 'authenticated' && !permissionsReady)
    ) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return <AppLayout>{children}</AppLayout>;
}
