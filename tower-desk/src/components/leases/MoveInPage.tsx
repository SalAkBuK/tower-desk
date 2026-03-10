"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MoveInPageProps {
    title?: string;
}

export function MoveInPage({ title = "Move-In (Request Flow)" }: MoveInPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const buildingId = searchParams.get("buildingId") || "";
    const returnTo = searchParams.get("returnTo") || undefined;

    const fallbackHref = useMemo(() => {
        if (!buildingId) return "/portal/contracts";
        const params = new URLSearchParams();
        params.set("buildingId", buildingId);
        return `/portal/contracts?${params.toString()}`;
    }, [buildingId]);
    const moveRequestQueueHref = useMemo(() => {
        const params = new URLSearchParams();
        params.set("tab", "pending");
        params.set("queue", "move-in");
        params.set("requestStatus", "PENDING");
        if (buildingId) params.set("buildingId", buildingId);
        return `/portal/contracts?${params.toString()}`;
    }, [buildingId]);

    const closePage = () => {
        router.push(returnTo || fallbackHref);
    };

    return (
        <div className="space-y-4 p-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="mt-2">
                    Direct move-in is disabled. Use the request-based flow:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Create and activate a contract.</li>
                    <li>Resident submits a move-in request.</li>
                    <li>Management approves and executes it from Move Requests.</li>
                </ol>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={closePage}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Contracts
                </Button>
                <Button onClick={() => router.push(moveRequestQueueHref)}>
                    Open Move Requests
                </Button>
            </div>
        </div>
    );
}
