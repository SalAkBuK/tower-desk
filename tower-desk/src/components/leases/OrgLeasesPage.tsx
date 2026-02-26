"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useAdminBuildings, useManagerBuildings, useOrgLeases } from "@/lib/queries";
import type { Lease, OrgLeaseStatusFilter, TimelineOrder } from "@/lib/types";

interface OrgLeasesPageProps {
    title?: string;
}

const ALL_BUILDINGS = "__ALL__";
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
type LeaseViewMode = "flat" | "grouped";

interface LeaseResidentGroup {
    key: string;
    residentId?: string;
    residentName: string;
    residentEmail: string;
    leases: Lease[];
    totalLeases: number;
    activeLeases: number;
    hasActiveLease: boolean;
    latestLease?: Lease;
    latestStartAt: number;
}

const isOrgLeaseStatusFilter = (value: string | null): value is OrgLeaseStatusFilter =>
    value === "ALL" || value === "ACTIVE" || value === "ENDED";

const isTimelineOrder = (value: string | null): value is TimelineOrder =>
    value === "asc" || value === "desc";

const isLeaseViewMode = (value: string | null): value is LeaseViewMode =>
    value === "flat" || value === "grouped";

const toDateTimeLocalInput = (value: string | null) => {
    if (!value) return "";
    if (DATETIME_LOCAL_PATTERN.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

const formatMoney = (value?: string | number | null) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "string" ? Number(value) : value;
    if (Number.isNaN(num)) return String(value);
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
};

const mergeById = (prev: Lease[], next: Lease[]) => {
    const map = new Map<string, Lease>();
    prev.forEach((item) => map.set(item.id, item));
    next.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
};

const toIsoOrUndefined = (value: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
};

const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
};

const toComparableTime = (value?: string | null) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const compareLeasesByResidentGroup = (a: Lease, b: Lease) => {
    if (a.status !== b.status) {
        if (a.status === "ACTIVE") return -1;
        if (b.status === "ACTIVE") return 1;
    }
    const aStart = toComparableTime(a.leaseStartDate);
    const bStart = toComparableTime(b.leaseStartDate);
    if (aStart !== bStart) return bStart - aStart;
    return a.id.localeCompare(b.id);
};

export function OrgLeasesPage({ title = "Leases" }: OrgLeasesPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const leaseBasePath = "/portal/leases";

    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );
    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);

    const [status, setStatus] = useState<OrgLeaseStatusFilter>(() => {
        const param = searchParams.get("status");
        return isOrgLeaseStatusFilter(param) ? param : "ALL";
    });
    const [order, setOrder] = useState<TimelineOrder>(() => {
        const param = searchParams.get("order");
        return isTimelineOrder(param) ? param : "desc";
    });
    const [viewMode, setViewMode] = useState<LeaseViewMode>(() => {
        const param = searchParams.get("view");
        return isLeaseViewMode(param) ? param : "flat";
    });
    const [selectedBuildingId, setSelectedBuildingId] = useState(
        () => searchParams.get("buildingId") || ALL_BUILDINGS
    );
    const [search, setSearch] = useState(() => searchParams.get("q") || "");
    const [dateFromLocal, setDateFromLocal] = useState(
        () => toDateTimeLocalInput(searchParams.get("date_from"))
    );
    const [dateToLocal, setDateToLocal] = useState(
        () => toDateTimeLocalInput(searchParams.get("date_to"))
    );

    const [cursor, setCursor] = useState<string | null>(null);
    const [items, setItems] = useState<Lease[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const effectiveBuildingId = selectedBuildingId === ALL_BUILDINGS ? undefined : selectedBuildingId;
    const trimmedSearch = search.trim();

    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (status === "ALL") nextParams.delete("status");
        else nextParams.set("status", status);
        if (order === "desc") nextParams.delete("order");
        else nextParams.set("order", order);
        if (viewMode === "flat") nextParams.delete("view");
        else nextParams.set("view", viewMode);
        if (selectedBuildingId === ALL_BUILDINGS) nextParams.delete("buildingId");
        else nextParams.set("buildingId", selectedBuildingId);
        if (trimmedSearch) nextParams.set("q", trimmedSearch);
        else nextParams.delete("q");
        if (dateFromLocal) nextParams.set("date_from", dateFromLocal);
        else nextParams.delete("date_from");
        if (dateToLocal) nextParams.set("date_to", dateToLocal);
        else nextParams.delete("date_to");

        const nextQuery = nextParams.toString();
        const currentQuery = searchParams.toString();
        if (nextQuery !== currentQuery) {
            router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
        }
    }, [
        status,
        order,
        viewMode,
        selectedBuildingId,
        trimmedSearch,
        dateFromLocal,
        dateToLocal,
        pathname,
        router,
        searchParams,
    ]);

    useEffect(() => {
        setCursor(null);
        setItems([]);
        setNextCursor(null);
    }, [status, order, effectiveBuildingId, trimmedSearch, dateFromLocal, dateToLocal]);

    const leasesQuery = useOrgLeases(
        {
            status,
            order,
            buildingId: effectiveBuildingId,
            q: trimmedSearch || undefined,
            date_from: toIsoOrUndefined(dateFromLocal),
            date_to: toIsoOrUndefined(dateToLocal),
            cursor: cursor ?? undefined,
            limit: 50,
        },
        { enabled: true }
    );

    useEffect(() => {
        if (!leasesQuery.data) return;
        setNextCursor(leasesQuery.data.nextCursor ?? null);
        if (!cursor) {
            setItems(leasesQuery.data.items || []);
            return;
        }
        setItems((prev) => mergeById(prev, leasesQuery.data?.items || []));
    }, [leasesQuery.data, cursor]);

    const errorStatus = toErrorStatus(leasesQuery.error);
    const residentGroups = useMemo<LeaseResidentGroup[]>(() => {
        const map = new Map<string, LeaseResidentGroup>();
        items.forEach((lease) => {
            const residentId = lease.residentUserId || lease.resident?.id || undefined;
            const groupKey = residentId ? `resident:${residentId}` : `unassigned:${lease.id}`;
            const existing = map.get(groupKey);
            if (existing) {
                existing.leases.push(lease);
                return;
            }
            map.set(groupKey, {
                key: groupKey,
                residentId,
                residentName: lease.resident?.name || lease.resident?.email || residentId || "Unassigned Resident",
                residentEmail: lease.resident?.email || "",
                leases: [lease],
                totalLeases: 0,
                activeLeases: 0,
                hasActiveLease: false,
                latestLease: undefined,
                latestStartAt: Number.NEGATIVE_INFINITY,
            });
        });

        return Array.from(map.values())
            .map((group) => {
                const sortedLeases = [...group.leases].sort(compareLeasesByResidentGroup);
                const activeLeases = sortedLeases.filter((lease) => lease.status === "ACTIVE").length;
                const latestLease = sortedLeases[0];
                return {
                    ...group,
                    leases: sortedLeases,
                    totalLeases: sortedLeases.length,
                    activeLeases,
                    hasActiveLease: activeLeases > 0,
                    latestLease,
                    latestStartAt: toComparableTime(latestLease?.leaseStartDate),
                };
            })
            .sort((a, b) => {
                if (a.hasActiveLease !== b.hasActiveLease) return a.hasActiveLease ? -1 : 1;
                if (a.latestStartAt !== b.latestStartAt) return b.latestStartAt - a.latestStartAt;
                return a.residentName.localeCompare(b.residentName);
            });
    }, [items]);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Browse active and ended leases across your organization.
                </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="grid gap-3 lg:grid-cols-7">
                    <div className="lg:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search lease/resident/unit..."
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <Select value={status} onValueChange={(value) => setStatus(value as OrgLeaseStatusFilter)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All statuses</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="ENDED">Ended</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={order} onValueChange={(value) => setOrder(value as TimelineOrder)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Newest first</SelectItem>
                            <SelectItem value="asc">Oldest first</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={viewMode} onValueChange={(value) => setViewMode(value as LeaseViewMode)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="flat">Flat view</SelectItem>
                            <SelectItem value="grouped">Grouped by resident</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_BUILDINGS}>All buildings</SelectItem>
                            {buildingOptions.map((building) => (
                                <SelectItem key={building.id} value={building.id}>
                                    {building.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="datetime-local"
                        value={dateFromLocal}
                        onChange={(event) => setDateFromLocal(event.target.value)}
                    />
                    <Input
                        type="datetime-local"
                        value={dateToLocal}
                        onChange={(event) => setDateToLocal(event.target.value)}
                    />
                </div>

                <div className="mt-6">
                    {leasesQuery.isLoading && items.length === 0 ? (
                        <div className="space-y-3">
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                        </div>
                    ) : leasesQuery.isError && items.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                            {errorStatus === 404
                                ? "The org-wide leases endpoint is not available yet (`GET /api/org/leases`)."
                                : errorStatus === 401
                                    ? "Your session expired. Please sign in again."
                                : errorStatus === 403
                                    ? "You do not have access to view org leases."
                                    : errorStatus === 400
                                        ? "Invalid filters. Check date range and filter values."
                                        : "Failed to load leases."}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            No leases found.
                        </div>
                    ) : (
                        viewMode === "flat" ? (
                            <div className="rounded-lg border border-zinc-200 bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Resident</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Term</TableHead>
                                            <TableHead>Annual Rent</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Lease</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((lease) => (
                                            <TableRow
                                                key={lease.id}
                                                className="cursor-pointer"
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => router.push(`${leaseBasePath}/${lease.id}`)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        router.push(`${leaseBasePath}/${lease.id}`);
                                                    }
                                                }}
                                            >
                                                <TableCell className="text-sm text-zinc-700">
                                                    <div>{lease.resident?.name || "-"}</div>
                                                    <div className="text-xs text-zinc-500">{lease.resident?.email || lease.residentUserId}</div>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-700">
                                                    <div>{buildingNameById[lease.buildingId] || lease.buildingId}</div>
                                                    <div className="text-xs text-zinc-500">{lease.unit?.label ? `Unit ${lease.unit.label}` : lease.unitId}</div>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-700">
                                                    {formatDate(lease.leaseStartDate)} {" -> "} {formatDate(lease.leaseEndDate)}
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-700">{formatMoney(lease.annualRent)}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            lease.status === "ACTIVE"
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-zinc-100 text-zinc-700 border-zinc-200"
                                                        }
                                                    >
                                                        {lease.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <Link
                                                        href={`${leaseBasePath}/${lease.id}`}
                                                        className="font-medium text-blue-600 hover:underline"
                                                        onClick={(event) => event.stopPropagation()}
                                                        title={lease.id}
                                                    >
                                                        View
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {residentGroups.map((group) => {
                                    const latestLease = group.latestLease;
                                    const latestBuildingLabel = latestLease ? (buildingNameById[latestLease.buildingId] || latestLease.buildingId) : "N/A";
                                    const latestUnitLabel = latestLease?.unit?.label ? `Unit ${latestLease.unit.label}` : latestLease?.unitId || "N/A";
                                    return (
                                        <details key={group.key} className="rounded-lg border border-zinc-200 bg-white">
                                            <summary className="cursor-pointer list-none px-4 py-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-zinc-900">{group.residentName}</div>
                                                        <div className="text-xs text-zinc-500">{group.residentEmail || group.residentId || "No contact info"}</div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                        <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200">
                                                            {group.totalLeases} lease{group.totalLeases === 1 ? "" : "s"}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className={group.activeLeases > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-700 border-zinc-200"}
                                                        >
                                                            {group.activeLeases} active
                                                        </Badge>
                                                        <span className="text-zinc-500">
                                                            Latest: {latestBuildingLabel}, {latestUnitLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                            </summary>
                                            <div className="border-t border-zinc-100 px-2 pb-2 pt-1">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead>Unit</TableHead>
                                                            <TableHead>Term</TableHead>
                                                            <TableHead>Annual Rent</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead>Lease</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {group.leases.map((lease) => (
                                                            <TableRow
                                                                key={lease.id}
                                                                className="cursor-pointer"
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => router.push(`${leaseBasePath}/${lease.id}`)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter" || event.key === " ") {
                                                                        event.preventDefault();
                                                                        router.push(`${leaseBasePath}/${lease.id}`);
                                                                    }
                                                                }}
                                                            >
                                                                <TableCell className="text-sm text-zinc-700">
                                                                    <div>{buildingNameById[lease.buildingId] || lease.buildingId}</div>
                                                                    <div className="text-xs text-zinc-500">{lease.unit?.label ? `Unit ${lease.unit.label}` : lease.unitId}</div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-zinc-700">
                                                                    {formatDate(lease.leaseStartDate)} {" -> "} {formatDate(lease.leaseEndDate)}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-zinc-700">{formatMoney(lease.annualRent)}</TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={
                                                                            lease.status === "ACTIVE"
                                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                : "bg-zinc-100 text-zinc-700 border-zinc-200"
                                                                        }
                                                                        >
                                                                            {lease.status}
                                                                        </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    <Link
                                                                        href={`${leaseBasePath}/${lease.id}`}
                                                                        className="font-medium text-blue-600 hover:underline"
                                                                        onClick={(event) => event.stopPropagation()}
                                                                        title={lease.id}
                                                                    >
                                                                        View
                                                                    </Link>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {nextCursor ? (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() => setCursor(nextCursor)}
                                disabled={leasesQuery.isFetching}
                            >
                                {leasesQuery.isFetching ? "Loading..." : "Load more"}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
