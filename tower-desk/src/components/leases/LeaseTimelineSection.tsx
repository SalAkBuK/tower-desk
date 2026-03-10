"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaseTimeline } from "@/lib/queries";
import type {
    LeaseTimelineActivityAction,
    LeaseTimelineItem,
    LeaseTimelineQuery,
    LeaseTimelineSourceFilter,
    TimelineOrder,
} from "@/lib/types";

interface LeaseTimelineSectionProps {
    leaseId: string;
}

const DEFAULT_LIMIT = 20;

const SOURCE_OPTIONS: LeaseTimelineSourceFilter[] = ["ALL", "HISTORY", "ACTIVITY"];
const HISTORY_ACTION_OPTIONS = ["ALL", "CREATED", "UPDATED", "MOVED_OUT"] as const;
const ACTIVITY_ACTION_OPTIONS: Array<"ALL" | LeaseTimelineActivityAction> = [
    "ALL",
    "MOVE_IN",
    "MOVE_OUT",
    "DOCUMENT_ADDED",
    "DOCUMENT_DELETED",
    "ACCESS_CARD_ISSUED",
    "ACCESS_CARD_STATUS_CHANGED",
    "ACCESS_CARD_DELETED",
    "PARKING_STICKER_ISSUED",
    "PARKING_STICKER_STATUS_CHANGED",
    "PARKING_STICKER_DELETED",
    "OCCUPANTS_REPLACED",
    "PARKING_ALLOCATED",
    "PARKING_ALLOCATION_ENDED",
    "VEHICLE_ADDED",
    "VEHICLE_UPDATED",
    "VEHICLE_DELETED",
];

const mergeById = (prev: LeaseTimelineItem[], next: LeaseTimelineItem[]) => {
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

const toIsoOrUndefined = (value: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
};

const sourceClassName: Record<string, string> = {
    HISTORY: "bg-blue-50 text-blue-700",
    ACTIVITY: "bg-cyan-50 text-cyan-700",
};

const actionClassName: Record<string, string> = {
    CREATED: "bg-emerald-50 text-emerald-700",
    UPDATED: "bg-amber-50 text-amber-700",
    MOVED_OUT: "bg-zinc-100 text-zinc-700",
    MOVE_IN: "bg-emerald-50 text-emerald-700",
    MOVE_OUT: "bg-zinc-100 text-zinc-700",
    PARKING_ALLOCATED: "bg-cyan-50 text-cyan-700",
    PARKING_ALLOCATION_ENDED: "bg-orange-50 text-orange-700",
    VEHICLE_ADDED: "bg-emerald-50 text-emerald-700",
    VEHICLE_UPDATED: "bg-amber-50 text-amber-700",
    VEHICLE_DELETED: "bg-rose-50 text-rose-700",
};

const getActivityPayloadRows = (entry: LeaseTimelineItem): Array<{ label: string; value: string }> => {
    const payload = (entry.payload && typeof entry.payload === "object")
        ? entry.payload as Record<string, unknown>
        : {};

    const toText = (value: unknown) => {
        if (value === null || value === undefined) return "N/A";
        if (Array.isArray(value)) return value.join(", ");
        return String(value);
    };
    const getStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value.map((item) => String(item)).filter(Boolean);
    };

    if (entry.action === "PARKING_ALLOCATED") {
        const slotCodes = getStringArray(payload.slotCodes ?? payload.slots);
        const count = payload.count ?? (slotCodes.length > 0 ? slotCodes.length : undefined);
        return [
            { label: "Slot codes", value: slotCodes.length > 0 ? slotCodes.join(", ") : "N/A" },
            { label: "Count", value: count !== undefined ? String(count) : "N/A" },
        ];
    }

    if (entry.action === "PARKING_ALLOCATION_ENDED") {
        const code = payload.parkingSlotCode ?? payload.slotCode;
        const endedCount = payload.endedCount;
        return [
            { label: "Parking slot", value: toText(code) },
            { label: "Ended count", value: endedCount !== undefined ? String(endedCount) : "N/A" },
        ];
    }

    if (entry.action === "VEHICLE_ADDED" || entry.action === "VEHICLE_DELETED") {
        return [
            { label: "Plate number", value: toText(payload.plateNumber) },
            { label: "Label", value: toText(payload.label) },
        ];
    }

    if (entry.action === "VEHICLE_UPDATED") {
        const previous = (payload.previous && typeof payload.previous === "object")
            ? payload.previous as Record<string, unknown>
            : {};
        const current = (payload.current && typeof payload.current === "object")
            ? payload.current as Record<string, unknown>
            : {};
        return [
            { label: "Plate number", value: `${toText(previous.plateNumber)} -> ${toText(current.plateNumber)}` },
            { label: "Label", value: `${toText(previous.label)} -> ${toText(current.label)}` },
        ];
    }

    return [];
};

export function LeaseTimelineSection({ leaseId }: LeaseTimelineSectionProps) {
    const [source, setSource] = useState<LeaseTimelineSourceFilter>("ALL");
    const [historyAction, setHistoryAction] = useState<(typeof HISTORY_ACTION_OPTIONS)[number]>("ALL");
    const [activityAction, setActivityAction] = useState<(typeof ACTIVITY_ACTION_OPTIONS)[number]>("ALL");
    const [order, setOrder] = useState<TimelineOrder>("desc");
    const [dateFromLocal, setDateFromLocal] = useState("");
    const [dateToLocal, setDateToLocal] = useState("");

    const [appliedQuery, setAppliedQuery] = useState<LeaseTimelineQuery>({
        source: "ALL",
        order: "desc",
        limit: DEFAULT_LIMIT,
    });
    const [cursor, setCursor] = useState<string | null>(null);
    const [items, setItems] = useState<LeaseTimelineItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const query = useLeaseTimeline(
        leaseId,
        useMemo(
            () => ({
                ...appliedQuery,
                cursor: cursor ?? undefined,
            }),
            [appliedQuery, cursor]
        ),
        { enabled: Boolean(leaseId) }
    );

    useEffect(() => {
        setCursor(null);
        setItems([]);
        setNextCursor(null);
    }, [leaseId, appliedQuery]);

    useEffect(() => {
        if (!query.data) return;
        setNextCursor(query.data.nextCursor ?? null);
        if (!cursor) {
            setItems(query.data.items || []);
            return;
        }
        setItems((prev) => mergeById(prev, query.data?.items || []));
    }, [query.data, cursor]);

    const errorStatus = toErrorStatus(query.error);

    const applyFilters = () => {
        const includeHistoryFilter = source !== "ACTIVITY";
        const includeActivityFilter = source !== "HISTORY";
        setAppliedQuery({
            source,
            historyAction: includeHistoryFilter && historyAction !== "ALL" ? historyAction : undefined,
            activityAction: includeActivityFilter && activityAction !== "ALL" ? activityAction : undefined,
            date_from: toIsoOrUndefined(dateFromLocal),
            date_to: toIsoOrUndefined(dateToLocal),
            order,
            limit: DEFAULT_LIMIT,
        });
    };

    const resetFilters = () => {
        setSource("ALL");
        setHistoryAction("ALL");
        setActivityAction("ALL");
        setOrder("desc");
        setDateFromLocal("");
        setDateToLocal("");
        setAppliedQuery({
            source: "ALL",
            order: "desc",
            limit: DEFAULT_LIMIT,
        });
    };

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-zinc-900">Contract Timeline</h2>
                <p className="text-xs text-zinc-500">Unified field history and contract activity feed.</p>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                    <Label>Source</Label>
                    <Select value={source} onValueChange={(value) => setSource(value as LeaseTimelineSourceFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {SOURCE_OPTIONS.map((value) => (
                                <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>History Action</Label>
                    <Select value={historyAction} onValueChange={(value) => setHistoryAction(value as (typeof HISTORY_ACTION_OPTIONS)[number])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {HISTORY_ACTION_OPTIONS.map((value) => (
                                <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Activity Action</Label>
                    <Select value={activityAction} onValueChange={(value) => setActivityAction(value as (typeof ACTIVITY_ACTION_OPTIONS)[number])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {ACTIVITY_ACTION_OPTIONS.map((value) => (
                                <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Date From</Label>
                    <Input type="datetime-local" value={dateFromLocal} onChange={(event) => setDateFromLocal(event.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label>Date To</Label>
                    <Input type="datetime-local" value={dateToLocal} onChange={(event) => setDateToLocal(event.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label>Order</Label>
                    <Select value={order} onValueChange={(value) => setOrder(value as TimelineOrder)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Newest first</SelectItem>
                            <SelectItem value="asc">Oldest first</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end gap-2 md:col-span-3">
                    <Button variant="outline" onClick={applyFilters}>Apply filters</Button>
                    <Button variant="ghost" onClick={resetFilters}>Reset</Button>
                </div>
            </div>

            {query.isLoading && items.length === 0 ? (
                <div className="space-y-3">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            ) : query.isError && items.length === 0 ? (
                <div className="text-sm text-zinc-600">
                    {errorStatus === 400
                        ? "Invalid timeline filters. Check date range and filter values."
                        : errorStatus === 403
                            ? "You don't have access to view contract timeline."
                            : errorStatus === 404
                                ? "Contract timeline not found."
                                : "Failed to load contract timeline."}
                </div>
            ) : items.length === 0 ? (
                <div className="text-sm text-zinc-500">No timeline entries found.</div>
            ) : (
                <div className="space-y-4">
                    {items.map((entry) => {
                        const payload = entry.payload ?? null;
                        const payloadChanges = payload && typeof payload === "object" && "changes" in payload
                            ? (payload.changes as Record<string, { from: unknown; to: unknown }>)
                            : null;
                        const payloadEntries = payload && typeof payload === "object"
                            ? Object.entries(payload).filter(([key]) => key !== "changes")
                            : [];
                        const activityPayloadRows = getActivityPayloadRows(entry);
                        const actor =
                            entry.changedByUser?.name ||
                            entry.changedByUser?.email ||
                            entry.changedByUser?.id ||
                            "System";
                        return (
                            <div key={entry.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className={sourceClassName[entry.source] || "bg-zinc-100 text-zinc-700"}>
                                        {entry.source}
                                    </Badge>
                                    <Badge variant="secondary" className={actionClassName[entry.action] || "bg-zinc-100 text-zinc-700"}>
                                        {entry.action}
                                    </Badge>
                                    <span className="text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</span>
                                    <span className="text-xs text-zinc-400">by {actor}</span>
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
                                ) : activityPayloadRows.length > 0 ? (
                                    <div className="space-y-2">
                                        {activityPayloadRows.map((row) => (
                                            <div key={row.label} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr]">
                                                <div className="font-medium text-zinc-700">{row.label}</div>
                                                <div className="text-zinc-600">{row.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : payloadEntries.length > 0 ? (
                                    <div className="space-y-2">
                                        {payloadEntries.map(([key, value]) => (
                                            <div key={key} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr]">
                                                <div className="font-medium text-zinc-700">{key}</div>
                                                <div className="text-zinc-600">{formatValue(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-zinc-500">No payload details recorded.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {nextCursor ? (
                <div className="mt-4 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() => setCursor(nextCursor)}
                        disabled={query.isFetching}
                    >
                        {query.isFetching ? "Loading..." : "Load more"}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
