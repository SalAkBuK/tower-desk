"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MoveInDialog } from "@/components/leases/MoveInDialog";
import { Button } from "@/components/ui/button";

interface MoveInPageProps {
    title?: string;
}

export function MoveInPage({ title = "Move In Tenant" }: MoveInPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const buildingId = searchParams.get("buildingId") || "";
    const unitId = searchParams.get("unitId") || undefined;
    const unitLabel = searchParams.get("unitLabel") || undefined;
    const residentUserId = searchParams.get("residentUserId") || undefined;
    const residentName = searchParams.get("residentName") || undefined;
    const residentEmail = searchParams.get("residentEmail") || undefined;
    const returnTo = searchParams.get("returnTo") || undefined;

    const fallbackHref = useMemo(() => {
        if (!buildingId) return "/portal/leases";
        const params = new URLSearchParams();
        params.set("buildingId", buildingId);
        return `/portal/leases?${params.toString()}`;
    }, [buildingId]);

    const closePage = () => {
        router.push(returnTo || fallbackHref);
    };

    if (!buildingId) {
        return (
            <div className="space-y-4 p-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    A building must be selected before moving in a tenant.
                </div>
                <Button variant="outline" onClick={() => router.push("/portal/leases")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Leases
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="px-6 pt-6">
                <Button variant="outline" onClick={closePage}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Complete resident and lease details to finalize move-in.
                </p>
            </div>

            <MoveInDialog
                variant="page"
                onCancel={closePage}
                buildingId={buildingId}
                unitId={unitId}
                unitLabel={unitLabel}
                defaultResidentUserId={residentUserId}
                defaultResidentName={residentName}
                defaultResidentEmail={residentEmail}
            />
        </div>
    );
}
