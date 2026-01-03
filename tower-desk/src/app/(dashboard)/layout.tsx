"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { logAuth } from "@/lib/debugAuth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, role, status } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const lastRedirectRef = useRef<string | null>(null);

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
        if (status !== 'authenticated' || !user || !role) return;
        if (pathname === '/login' || pathname === '/403') return;
        if (pathname.startsWith('/sa') && role !== 'superadmin') {
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
        if (pathname.startsWith('/admin') && !(role === 'admin' || role === 'org_admin' || role === 'superadmin')) {
            logAuth('GUARD', `client redirect /403 from=${pathname} required=admin role=${role}`, {
                orgId: user?.orgId ?? null,
                userId: user?.id ?? null
            });
            if (lastRedirectRef.current !== `/403:${pathname}`) {
                router.replace('/403');
                lastRedirectRef.current = `/403:${pathname}`;
            }
            return;
        }
        if (pathname.startsWith('/manager') && !(role === 'manager' || role === 'superadmin')) {
            logAuth('GUARD', `client redirect /403 from=${pathname} required=manager role=${role}`, {
                orgId: user?.orgId ?? null,
                userId: user?.id ?? null
            });
            if (lastRedirectRef.current !== `/403:${pathname}`) {
                router.replace('/403');
                lastRedirectRef.current = `/403:${pathname}`;
            }
        }
    }, [mounted, pathname, router, user, role, status]);

    // Prevent flash of content
    if (!mounted || status === 'loading' || status === 'restoring') {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return <AppLayout>{children}</AppLayout>;
}
