"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OnboardingSetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const redirectHref = useMemo(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("mode", "invite");
        const query = params.toString();
        return `/reset-password${query ? `?${query}` : "?mode=invite"}`;
    }, [searchParams]);

    useEffect(() => {
        router.replace(redirectHref);
    }, [redirectHref, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f6f2ea] px-4 text-sm text-slate-600">
            Redirecting to set-password flow...
        </div>
    );
}
