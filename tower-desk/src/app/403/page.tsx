"use client";

import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getDefaultHomeRoute } from "@/lib/homeRoute";
import { logAuth } from "@/lib/debugAuth";
import { useRouter } from "next/navigation";

export default function ForbiddenPage() {
    const { user, status, role, hasToken } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const query = searchParams?.toString() ?? '';
        logAuth('403', `mount path=/403 query=${query || 'none'}`, {
            referrer: typeof document !== 'undefined' ? document.referrer : 'server',
            resolvedRole: role ?? 'none',
            userRole: user?.role ?? 'none',
            hasToken,
            userId: user?.id ?? null
        });
    }, [searchParams, role, user?.id, user?.role, hasToken]);

    const handleGoHome = () => {
        if (status !== 'authenticated') {
            logAuth('403', `home_click blocked status=${status}`);
            router.replace('/login');
            return;
        }
        if (!role) {
            logAuth('403', `home_click missing role -> /login`, { userId: user?.id ?? null });
            router.replace('/login');
            return;
        }
        const destination = getDefaultHomeRoute(user, role);
        logAuth('403', `home_click destination=${destination}`, {
            role: role ?? 'none',
            userId: user?.id ?? null
        });
        router.replace(destination);
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-900">
            <div className="bg-red-50 p-4 rounded-full mb-4">
                <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">403 - Access Denied</h1>
            <p className="text-zinc-500 mb-8 max-w-md text-center">
                You do not have permission to access this resource. Please contact your administrator if you believe this is a mistake.
            </p>
            <Button onClick={handleGoHome} disabled={status !== 'authenticated'}>
                Go Back Home
            </Button>
        </div>
    );
}
