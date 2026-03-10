"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useAdminBuildings, useManagerBuildings, useResidentLeases, useResidentLeaseTimeline } from "@/lib/queries";
import type { LeaseHistoryAction, LeaseTimelineItem, ResidentLeaseListItem, TimelineOrder } from "@/lib/types";

interface ResidentLeaseHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residentUserId?: string;
    residentName?: string;
    residentEmail?: string;
    leaseBasePath?: string;
}

const DEFAULT_LIMIT = 20;

const mergeLeaseItems = (prev: ResidentLeaseListItem[], next: ResidentLeaseListItem[]) => {
    const map = new Map<string, ResidentLeaseListItem>();
    prev.forEach((item) => map.set(item.leaseId, item));
    next.forEach((item) => map.set(item.leaseId, item));
    return Array.from(map.values());
};

const mergeTimelineItems = (prev: LeaseTimelineItem[], next: LeaseTimelineItem[]) => {
    const map = new Map<string, LeaseTimelineItem>();
    prev.forEach((item) => map.set(item.id, item));
    next.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
};

const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
};

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
};

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

const formatValue = (value: unknown) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" && value.length === 0) return "\"\"";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
};

const statusBadgeClass: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    ENDED: "bg-zinc-100 text-zinc-700",
};

const actionBadgeClass: Record<string, string> = {
    CREATED: "bg-emerald-50 text-emerald-700",
    UPDATED: "bg-amber-50 text-amber-700",
    MOVED_OUT: "bg-zinc-100 text-zinc-700",
};

export function ResidentLeaseHistoryDialog({
    open,
    onOpenChange,
    residentUserId,
    residentName,
    residentEmail,
    leaseBasePath,
}: ResidentLeaseHistoryDialogProps) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);

    const [activeTab, setActiveTab] = useState<"leases" | "timeline">("leases");
    const [timelineAction, setTimelineAction] = useState<"ALL" | LeaseHistoryAction>("ALL");
    const [timelineOrder, setTimelineOrder] = useState<TimelineOrder>("desc");

    const [leaseCursor, setLeaseCursor] = useState<string | null>(null);
    const [leaseItems, setLeaseItems] = useState<ResidentLeaseListItem[]>([]);
    const [leaseNextCursor, setLeaseNextCursor] = useState<string | null>(null);

    const [timelineCursor, setTimelineCursor] = useState<string | null>(null);
    const [timelineItems, setTimelineItems] = useState<LeaseTimelineItem[]>([]);
    const [timelineNextCursor, setTimelineNextCursor] = useState<string | null>(null);

    const leasesQuery = useResidentLeases(
        residentUserId,
        useMemo(
            () => ({
                status: "ALL",
                order: "desc",
                limit: DEFAULT_LIMIT,
                cursor: leaseCursor ?? undefined,
            }),
            [leaseCursor]
        ),
        { enabled: open && activeTab === "leases" && Boolean(residentUserId) }
    );

    const residentTimelineQuery = useResidentLeaseTimeline(
        residentUserId,
        useMemo(
            () => ({
                action: timelineAction === "ALL" ? undefined : timelineAction,
                order: timelineOrder,
                limit: DEFAULT_LIMIT,
                cursor: timelineCursor ?? undefined,
            }),
            [timelineAction, timelineOrder, timelineCursor]
        ),
        { enabled: open && activeTab === "timeline" && Boolean(residentUserId) }
    );

    useEffect(() => {
        if (!open) return;
        setActiveTab("leases");
        setLeaseCursor(null);
        setLeaseItems([]);
        setLeaseNextCursor(null);
        setTimelineCursor(null);
        setTimelineItems([]);
        setTimelineNextCursor(null);
    }, [open, residentUserId]);

    useEffect(() => {
        if (!leasesQuery.data) return;
        setLeaseNextCursor(leasesQuery.data.nextCursor ?? null);
        if (!leaseCursor) {
            setLeaseItems(leasesQuery.data.items || []);
            return;
        }
        setLeaseItems((prev) => mergeLeaseItems(prev, leasesQuery.data?.items || []));
    }, [leasesQuery.data, leaseCursor]);

    useEffect(() => {
        if (!residentTimelineQuery.data) return;
        setTimelineNextCursor(residentTimelineQuery.data.nextCursor ?? null);
        if (!timelineCursor) {
            setTimelineItems(residentTimelineQuery.data.items || []);
            return;
        }
        setTimelineItems((prev) => mergeTimelineItems(prev, residentTimelineQuery.data?.items || []));
    }, [residentTimelineQuery.data, timelineCursor]);

    useEffect(() => {
        setTimelineCursor(null);
        setTimelineItems([]);
        setTimelineNextCursor(null);
    }, [timelineAction, timelineOrder]);

    const leaseErrorStatus = toErrorStatus(leasesQuery.error);
    const timelineErrorStatus = toErrorStatus(residentTimelineQuery.error);
    const canOpenLease = Boolean(leaseBasePath);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Resident Contract History</DialogTitle>
                    <DialogDescription>
                        {residentName || "Resident"}{residentEmail ? ` (${residentEmail})` : ""}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "leases" | "timeline")} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="leases">Leases</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    </TabsList>

                    <TabsContent value="leases" className="space-y-4">
                        {leasesQuery.isLoading && leaseItems.length === 0 ? (
                            <div className="space-y-3">
                                <Skeleton className="h-14" />
                                <Skeleton className="h-14" />
                            </div>
                        ) : leasesQuery.isError && leaseItems.length === 0 ? (
                            <div className="text-sm text-zinc-600">
                                {leaseErrorStatus === 403
                                    ? "You don't have access to view resident leases."
                                    : leaseErrorStatus === 404
                                        ? "Resident leases not found."
                                        : "Failed to load resident leases."}
                            </div>
                        ) : leaseItems.length === 0 ? (
                            <div className="text-sm text-zinc-500">No leases found for this resident.</div>
                        ) : (
                            <div className="space-y-3">
                                {leaseItems.map((lease) => (
                                    <div key={lease.leaseId} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-sm font-medium text-zinc-900">
                                                {lease.building?.name || (lease.building?.id ? buildingNameById[lease.building.id] : "") || lease.building?.id || "Unknown building"}
                                                {lease.unit?.label ? `, Unit ${lease.unit.label}` : lease.unit?.id ? `, Unit ${lease.unit.id}` : ""}
                                            </div>
                                            <Badge className={statusBadgeClass[lease.status] || "bg-zinc-100 text-zinc-700"}>{lease.status}</Badge>
                                        </div>
                                        <div className="mt-2 text-xs text-zinc-500">
                                            {formatDate(lease.leaseStartDate)} {" -> "} {formatDate(lease.leaseEndDate)}
                                            {lease.actualMoveOutDate ? ` | moved out ${formatDate(lease.actualMoveOutDate)}` : ""}
                                        </div>
                                        <div className="mt-3 flex items-center gap-3 text-xs">
                                            <span className="text-zinc-500">Lease ID: {lease.leaseId}</span>
                                            {canOpenLease ? (
                                                <Link
                                                    href={`${leaseBasePath}/${lease.leaseId}?tab=history`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    Open timeline
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {leaseNextCursor ? (
                            <div className="flex justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => setLeaseCursor(leaseNextCursor)}
                                    disabled={leasesQuery.isFetching}
                                >
                                    {leasesQuery.isFetching ? "Loading..." : "Load more"}
                                </Button>
                            </div>
                        ) : null}
                    </TabsContent>

                    <TabsContent value="timeline" className="space-y-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                                <div className="text-xs font-medium text-zinc-600">Action</div>
                                <Select value={timelineAction} onValueChange={(value) => setTimelineAction(value as "ALL" | LeaseHistoryAction)}>
                                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        <SelectItem value="CREATED">CREATED</SelectItem>
                                        <SelectItem value="UPDATED">UPDATED</SelectItem>
                                        <SelectItem value="MOVED_OUT">MOVED_OUT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs font-medium text-zinc-600">Order</div>
                                <Select value={timelineOrder} onValueChange={(value) => setTimelineOrder(value as TimelineOrder)}>
                                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="desc">Newest first</SelectItem>
                                        <SelectItem value="asc">Oldest first</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {residentTimelineQuery.isLoading && timelineItems.length === 0 ? (
                            <div className="space-y-3">
                                <Skeleton className="h-14" />
                                <Skeleton className="h-14" />
                            </div>
                        ) : residentTimelineQuery.isError && timelineItems.length === 0 ? (
                            <div className="text-sm text-zinc-600">
                                {timelineErrorStatus === 400
                                    ? "Invalid timeline query."
                                    : timelineErrorStatus === 403
                                        ? "You don't have access to view resident timeline."
                                        : timelineErrorStatus === 404
                                            ? "Resident timeline not found."
                                            : "Failed to load resident timeline."}
                            </div>
                        ) : timelineItems.length === 0 ? (
                            <div className="text-sm text-zinc-500">No timeline entries found.</div>
                        ) : (
                            <div className="space-y-3">
                                {timelineItems.map((entry) => {
                                    const payloadChanges = entry.payload && typeof entry.payload === "object" && "changes" in entry.payload
                                        ? (entry.payload.changes as Record<string, { from: unknown; to: unknown }>)
                                        : null;
                                    const actor =
                                        entry.changedByUser?.name ||
                                        entry.changedByUser?.email ||
                                        entry.changedByUser?.id ||
                                        "System";
                                    return (
                                        <div key={entry.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <Badge className={actionBadgeClass[entry.action] || "bg-zinc-100 text-zinc-700"}>
                                                    {entry.action}
                                                </Badge>
                                                <span className="text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</span>
                                                <span className="text-xs text-zinc-400">by {actor}</span>
                                                {entry.leaseId && canOpenLease ? (
                                                    <Link href={`${leaseBasePath}/${entry.leaseId}?tab=history`} className="text-xs text-blue-600 hover:underline">
                                                        Open contract timeline
                                                    </Link>
                                                ) : null}
                                            </div>
                                            {payloadChanges && Object.keys(payloadChanges).length > 0 ? (
                                                <div className="space-y-2">
                                                    {Object.entries(payloadChanges).map(([field, change]) => (
                                                        <div key={field} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr]">
                                                            <div className="font-medium text-zinc-700">{field}</div>
                                                            <div className="text-zinc-600">
                                                                <span className="text-zinc-500">{formatValue(change?.from)}</span>
                                                                {" -> "}
                                                                <span className="text-zinc-900">{formatValue(change?.to)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-zinc-500">No field changes recorded.</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {timelineNextCursor ? (
                            <div className="flex justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => setTimelineCursor(timelineNextCursor)}
                                    disabled={residentTimelineQuery.isFetching}
                                >
                                    {residentTimelineQuery.isFetching ? "Loading..." : "Load more"}
                                </Button>
                            </div>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
