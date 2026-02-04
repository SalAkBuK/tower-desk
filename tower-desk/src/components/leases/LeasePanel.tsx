"use client";

import { useState } from "react";
import Link from "next/link";
import { useActiveLease } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoveInDialog } from "./MoveInDialog";
import { MoveOutDialog } from "./MoveOutDialog";

interface LeasePanelProps {
    buildingId: string;
    unitId: string;
    unitLabel?: string;
}

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
};

const formatMoney = (value?: string | number | null) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (Number.isNaN(num)) return String(value);
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
};

export function LeasePanel({ buildingId, unitId, unitLabel }: LeasePanelProps) {
    const { data: lease, isLoading, isError } = useActiveLease(buildingId, unitId, {
        enabled: Boolean(buildingId) && Boolean(unitId),
    });

    const [moveInOpen, setMoveInOpen] = useState(false);
    const [moveOutOpen, setMoveOutOpen] = useState(false);

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Lease</h3>
                    <p className="text-xs text-zinc-400">Active lease for this unit.</p>
                </div>
                {!isLoading && !lease && (
                    <Button size="sm" onClick={() => setMoveInOpen(true)}>
                        Move In
                    </Button>
                )}
                {lease && lease.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => setMoveOutOpen(true)}>
                        Move Out
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                </div>
            ) : isError ? (
                <div className="text-sm text-rose-600">Unable to load lease information.</div>
            ) : lease ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className={lease.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}
                        >
                            {lease.status}
                        </Badge>
                        <Link
                            href={`/admin/leases/${lease.id}`}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            View Details
                        </Link>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-400">Resident</div>
                            <div className="text-sm font-medium text-zinc-900">
                                {lease.resident?.name || lease.resident?.email || lease.residentUserId || "N/A"}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-400">Annual Rent</div>
                            <div className="text-sm font-medium text-zinc-900">{formatMoney(lease.annualRent)}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-400">Start Date</div>
                            <div className="text-sm font-medium text-zinc-900">{formatDate(lease.leaseStartDate)}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-400">End Date</div>
                            <div className="text-sm font-medium text-zinc-900">{formatDate(lease.leaseEndDate)}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-zinc-500">No active lease for this unit.</div>
            )}

            <MoveInDialog
                open={moveInOpen}
                onOpenChange={setMoveInOpen}
                buildingId={buildingId}
                unitId={unitId}
                unitLabel={unitLabel}
            />

            {lease && (
                <MoveOutDialog
                    open={moveOutOpen}
                    onOpenChange={setMoveOutOpen}
                    buildingId={buildingId}
                    leaseId={lease.id}
                    unitId={unitId}
                    unitLabel={unitLabel}
                    residentName={lease.resident?.name}
                />
            )}
        </div>
    );
}
