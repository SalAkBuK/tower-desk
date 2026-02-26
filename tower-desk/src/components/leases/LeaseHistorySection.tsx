"use client";

import { useMemo } from "react";
import { useLeaseHistory } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaseHistorySectionProps {
    leaseId: string;
}

const formatDateTime = (value?: string | null) => {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const formatValue = (value: string | number | boolean | null) => {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" && value.length === 0) return '""';
    return String(value);
};

const actionClassName: Record<string, string> = {
    CREATED: "bg-emerald-50 text-emerald-700",
    UPDATED: "bg-amber-50 text-amber-700",
    MOVED_OUT: "bg-zinc-100 text-zinc-700",
};

export function LeaseHistorySection({ leaseId }: LeaseHistorySectionProps) {
    const { data, isLoading, isError, error } = useLeaseHistory(leaseId, {
        enabled: Boolean(leaseId),
    });

    const status =
        typeof error === "object" &&
        error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status)
            : undefined;

    const sortedHistory = useMemo(() => {
        const entries = data || [];
        return [...entries].sort((a, b) => {
            const left = new Date(a.createdAt).getTime();
            const right = new Date(b.createdAt).getTime();
            return right - left;
        });
    }, [data]);

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-zinc-900">Lease History</h2>
                <p className="text-xs text-zinc-500">Field-level changes for this lease.</p>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            ) : isError ? (
                <div className="text-sm text-zinc-600">
                    {status === 403
                        ? "You don't have access to view lease history."
                        : status === 404
                            ? "Lease history not found."
                            : "Failed to load lease history."}
                </div>
            ) : sortedHistory.length === 0 ? (
                <div className="text-sm text-zinc-500">No history yet.</div>
            ) : (
                <div className="space-y-4">
                    {sortedHistory.map((entry) => {
                        const changes = Object.entries(entry.changes || {});
                        const actor =
                            entry.changedByUser?.name ||
                            entry.changedByUser?.email ||
                            entry.changedByUser?.id ||
                            "System";
                        return (
                            <div key={entry.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className={actionClassName[entry.action] || "bg-zinc-100 text-zinc-700"}
                                    >
                                        {entry.action}
                                    </Badge>
                                    <span className="text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</span>
                                    <span className="text-xs text-zinc-400">by {actor}</span>
                                </div>

                                {changes.length === 0 ? (
                                    <div className="text-sm text-zinc-500">No field changes recorded.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {changes.map(([field, change]) => (
                                            <div key={field} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr]">
                                                <div className="font-medium text-zinc-700">{field}</div>
                                                <div className="text-zinc-600">
                                                    <span className="text-zinc-500">{formatValue(change.from)}</span>
                                                    {" -> "}
                                                    <span className="text-zinc-900">{formatValue(change.to)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
