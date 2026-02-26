"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { logAuth } from "@/lib/debugAuth";
import { resolvePortalRoute } from "@/lib/portalRoute";

export function PortalRedirect({ slug }: { slug?: string[] }) {
    const { user, baseRole, status, permissionsReady } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const slugKey = (slug ?? []).join("/");

    useEffect(() => {
        if (status === "unknown" || status === "restoring") return;
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated" || !permissionsReady) return;

        const resolution = resolvePortalRoute({ user, baseRole, slug });
        const query = searchParams?.toString();
        const destination = query ? `${resolution.destination}?${query}` : resolution.destination;

        logAuth("PORTAL", `resolve path=${pathname ?? "/portal"} -> ${destination}`, {
            reason: resolution.reason,
            segment: resolution.segment ?? null,
            role: baseRole ?? null,
            userId: user?.id ?? null,
        });
        router.replace(destination);
    }, [
        baseRole,
        pathname,
        permissionsReady,
        router,
        searchParams,
        slug,
        slugKey,
        status,
        user,
    ]);

    if (status === "unknown" || status === "restoring" || (status === "authenticated" && !permissionsReady)) {
        return (
            <div className="h-full min-h-[50vh] w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    return null;
}
