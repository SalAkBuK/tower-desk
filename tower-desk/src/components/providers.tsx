"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DEBUG_AUTH, logAuth } from "@/lib/debugAuth";

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
        return new QueryClient({
            defaultOptions: {
                queries: {
                    refetchOnWindowFocus: true,
                    staleTime: isProd ? 30_000 : 0,
                    onError: (error) => {
                        if (shouldToastAuthError(error)) {
                            const message = (error as Error)?.message || "Your session expired. Please sign in again.";
                            toast.error(message);
                        }
                    },
                },
                mutations: {
                    onError: (error) => {
                        if (shouldToastAuthError(error)) {
                            const message = (error as Error)?.message || "Your session expired. Please sign in again.";
                            toast.error(message);
                        }
                    },
                },
            },
        });
    });
    useNavigationLogger();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster />
        </QueryClientProvider>
    );
}

function useNavigationLogger() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { role, user, selectedOrgId, selectedBuildingId, status } = useAuth();
    const previousRef = useRef<string | null>(null);

    useEffect(() => {
        if (!DEBUG_AUTH) return;
        const query = searchParams?.toString();
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
