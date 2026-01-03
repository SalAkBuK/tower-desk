"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList } from "lucide-react";

import { ServiceRequest } from "@/lib/types";
import { getStatusIcon, priorityStyles, statusLabels, statusStyles } from "@/components/requests/requestDisplay";

interface RequestsGridProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (request: ServiceRequest) => void;
    buildingNameById?: Record<string, string>;
}

export function RequestsGrid({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
}: RequestsGridProps) {
    if (isLoading) {
        const skeletonCards = [
            { key: 1, className: "" },
            { key: 2, className: "" },
            { key: 3, className: "hidden sm:block" },
            { key: 4, className: "hidden sm:block" },
            { key: 5, className: "hidden xl:block" },
            { key: 6, className: "hidden xl:block" },
        ];

        return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {skeletonCards.map((item) => (
                    <div key={item.key} className={`rounded-xl border border-zinc-200 bg-white p-4 ${item.className}`}>
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="mt-3 h-4 w-full" />
                        <Skeleton className="mt-2 h-4 w-5/6" />
                        <Skeleton className="mt-6 h-5 w-24" />
                    </div>
                ))}
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white">
                    <ClipboardList className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-900">No requests found</h3>
                <p className="mt-1 text-xs text-zinc-500">No service requests match the current filter.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {requests.map((req) => (
                <Card
                    key={req.id}
                    className={`border-zinc-200 ${onSelect ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md" : ""}`}
                    onClick={() => onSelect?.(req)}
                >
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold text-zinc-900">{req.title}</CardTitle>
                                <p className="text-sm text-zinc-500 line-clamp-2">{req.description}</p>
                            </div>
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize ${priorityStyles[req.priority]}`}>
                                {req.priority}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Badge variant="outline" className={`inline-flex items-center gap-1 ${statusStyles[req.status]}`}>
                            {getStatusIcon(req.status)}
                            <span>{statusLabels[req.status]}</span>
                        </Badge>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                            <span>{buildingNameById?.[req.buildingId] || req.buildingId}</span>
                            <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
