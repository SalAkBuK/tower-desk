"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceRequest } from "@/lib/types";
import { getStatusIcon, priorityStyles, statusLabels, statusStyles } from "@/components/requests/requestDisplay";

interface RequestsGridProps {
    requests: ServiceRequest[] | undefined;
    isLoading: boolean;
    onSelect?: (requestId: string) => void;
    buildingNameById?: Record<string, string>;
}

export function RequestsGrid({
    requests,
    isLoading,
    onSelect,
    buildingNameById,
}: RequestsGridProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                ))}
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-zinc-200">
                <p className="text-zinc-500">No requests found.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {requests.map((req) => (
                <Card
                    key={req.id}
                    className={`border-zinc-200 ${onSelect ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
                    onClick={() => onSelect?.(req.id)}
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
