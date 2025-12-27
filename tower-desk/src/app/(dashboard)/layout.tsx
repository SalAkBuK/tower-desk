"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user, role } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            router.push('/login');
        }
    }, [mounted, isAuthenticated, router]);

    useEffect(() => {
        if (!mounted || !user || !role) return;
        if (pathname.startsWith('/sa') && role !== 'superadmin') {
            router.push('/403');
            return;
        }
        if (pathname.startsWith('/admin') && !(role === 'admin' || role === 'superadmin')) {
            router.push('/403');
            return;
        }
        if (pathname.startsWith('/manager') && !(role === 'manager' || role === 'superadmin')) {
            router.push('/403');
        }
    }, [mounted, pathname, router, user, role]);

    // Prevent flash of content
    if (!mounted || !user) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return <AppLayout>{children}</AppLayout>;
}
