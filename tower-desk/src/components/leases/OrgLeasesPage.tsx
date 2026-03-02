"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRightLeft, LogOut, MoreHorizontal, Search, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { getLeaseActionIds } from "@/lib/leaseNavigation";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { useAdminBuildings, useManagerBuildings, useOrgLeases, useOrgResidents } from "@/lib/queries";
import { EditLeaseDialog } from "@/components/leases/EditLeaseDialog";
import { MoveOutDialog } from "@/components/leases/MoveOutDialog";
import { TransferUnitDialog } from "@/components/leases/TransferUnitDialog";
import type { Lease, OrgLeaseStatusFilter, OrgResidentListItem, TimelineOrder } from "@/lib/types";

interface OrgLeasesPageProps {
    title?: string;
}

const ALL_BUILDINGS = "__ALL__";
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
type LeaseViewMode = "flat" | "grouped";
type LeasePageTab = "leases" | "pending";

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

interface MoveOutContext {
    buildingId: string;
    leaseId: string;
    unitId?: string;
    unitLabel?: string;
    residentName?: string;
}

interface TransferContext {
    buildingId: string;
    leaseId: string;
    unitId?: string;
    unitLabel?: string;
    residentUserId?: string;
    residentName?: string;
    residentEmail?: string;
}

interface CursorListState<T> {
    cursor: string | null;
    items: T[];
    nextCursor: string | null;
}

type CursorListAction<T> =
    | { type: "reset" }
    | { type: "setCursor"; cursor: string | null }
    | { type: "append"; cursor: string | null; items: T[]; nextCursor: string | null };

const isOrgLeaseStatusFilter = (value: string | null): value is OrgLeaseStatusFilter =>
    value === "ALL" || value === "ACTIVE" || value === "ENDED";

const isTimelineOrder = (value: string | null): value is TimelineOrder =>
    value === "asc" || value === "desc";

const isLeaseViewMode = (value: string | null): value is LeaseViewMode =>
    value === "flat" || value === "grouped";

const isLeasePageTab = (value: string | null): value is LeasePageTab =>
    value === "leases" || value === "pending";

const toDateTimeLocalInput = (value: string | null) => {
    if (!value) return "";
    if (DATETIME_LOCAL_PATTERN.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDateTimeLocalFromDate = (date: Date) => {
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

const mergeResidentsByUserId = (prev: OrgResidentListItem[], next: OrgResidentListItem[]) => {
    const map = new Map<string, OrgResidentListItem>();
    prev.forEach((item) => map.set(item.user.id, item));
    next.forEach((item) => map.set(item.user.id, item));
    return Array.from(map.values());
};

const initialCursorListState = <T,>(): CursorListState<T> => ({
    cursor: null,
    items: [],
    nextCursor: null,
});

const createCursorListReducer = <T,>(merge: (prev: T[], next: T[]) => T[]) =>
    (state: CursorListState<T>, action: CursorListAction<T>): CursorListState<T> => {
        switch (action.type) {
            case "reset":
                return initialCursorListState<T>();
            case "setCursor":
                return {
                    ...state,
                    cursor: action.cursor,
                };
            case "append":
                return {
                    cursor: state.cursor,
                    nextCursor: action.nextCursor,
                    items: action.cursor ? merge(state.items, action.items) : action.items,
                };
            default:
                return state;
        }
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
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canWriteLease =
        hasPermission(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases");
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
    const [activeTab, setActiveTab] = useState<LeasePageTab>(() => {
        const param = searchParams.get("tab");
        return isLeasePageTab(param) ? param : "leases";
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

    const [leaseListState, dispatchLeaseList] = useReducer(
        createCursorListReducer<Lease>(mergeById),
        undefined,
        () => initialCursorListState<Lease>()
    );
    const [editLeaseContext, setEditLeaseContext] = useState<Lease | null>(null);
    const [moveOutContext, setMoveOutContext] = useState<MoveOutContext | null>(null);
    const [transferContext, setTransferContext] = useState<TransferContext | null>(null);
    const [residentListState, dispatchResidentList] = useReducer(
        createCursorListReducer<OrgResidentListItem>(mergeResidentsByUserId),
        undefined,
        () => initialCursorListState<OrgResidentListItem>()
    );

    const effectiveBuildingId = selectedBuildingId === ALL_BUILDINGS ? undefined : selectedBuildingId;
    const trimmedSearch = search.trim();
    const selectedBuildingForActions = effectiveBuildingId ?? "";
    const canOpenMoveIn = Boolean(selectedBuildingForActions);
    const hasLeaseFilters =
        status !== "ALL" ||
        selectedBuildingId !== ALL_BUILDINGS ||
        Boolean(trimmedSearch) ||
        Boolean(dateFromLocal) ||
        Boolean(dateToLocal);
    const leaseCounts = useMemo(() => {
        let active = 0;
        let ended = 0;
        leaseListState.items.forEach((lease) => {
            if (lease.status === "ACTIVE") active += 1;
            else ended += 1;
        });
        return {
            active,
            ended,
            total: leaseListState.items.length,
        };
    }, [leaseListState.items]);

    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (status === "ALL") nextParams.delete("status");
        else nextParams.set("status", status);
        if (order === "desc") nextParams.delete("order");
        else nextParams.set("order", order);
        if (viewMode === "flat") nextParams.delete("view");
        else nextParams.set("view", viewMode);
        if (activeTab === "leases") nextParams.delete("tab");
        else nextParams.set("tab", activeTab);
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
        activeTab,
        selectedBuildingId,
        trimmedSearch,
        dateFromLocal,
        dateToLocal,
        pathname,
        router,
        searchParams,
    ]);

    useEffect(() => {
        dispatchLeaseList({ type: "reset" });
    }, [status, order, effectiveBuildingId, trimmedSearch, dateFromLocal, dateToLocal]);

    useEffect(() => {
        dispatchResidentList({ type: "reset" });
    }, [trimmedSearch]);

    const leasesQuery = useOrgLeases(
        {
            status,
            order,
            buildingId: effectiveBuildingId,
            q: trimmedSearch || undefined,
            date_from: toIsoOrUndefined(dateFromLocal),
            date_to: toIsoOrUndefined(dateToLocal),
            cursor: leaseListState.cursor ?? undefined,
            limit: 50,
        },
        { enabled: true }
    );

    useEffect(() => {
        if (!leasesQuery.data) return;
        dispatchLeaseList({
            type: "append",
            cursor: leaseListState.cursor,
            items: leasesQuery.data.items || [],
            nextCursor: leasesQuery.data.nextCursor ?? null,
        });
    }, [leaseListState.cursor, leasesQuery.data]);

    const residentsWithoutActiveLeaseQuery = useOrgResidents(
        {
            status: "WITHOUT_OCCUPANCY",
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: residentListState.cursor ?? undefined,
            includeProfile: true,
        },
        { enabled: true }
    );

    useEffect(() => {
        const data = residentsWithoutActiveLeaseQuery.data;
        if (!data) return;
        dispatchResidentList({
            type: "append",
            cursor: residentListState.cursor,
            items: data.items || [],
            nextCursor: data.nextCursor ?? null,
        });
    }, [residentListState.cursor, residentsWithoutActiveLeaseQuery.data]);

    const isPendingInitialLoading =
        residentsWithoutActiveLeaseQuery.isLoading && residentListState.items.length === 0;
    const pendingGroups = useMemo(() => {
        const groups = {
            NEW: [] as OrgResidentListItem[],
            FORMER: [] as OrgResidentListItem[],
            OTHER: [] as OrgResidentListItem[],
        };
        residentListState.items.forEach((resident) => {
            const residentStatus = resident.residentStatus ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
            if (residentStatus === "NEW") groups.NEW.push(resident);
            else if (residentStatus === "FORMER") groups.FORMER.push(resident);
            else groups.OTHER.push(resident);
        });
        return groups;
    }, [residentListState.items]);

    const errorStatus = toErrorStatus(leasesQuery.error);
    const residentGroups = useMemo<LeaseResidentGroup[]>(() => {
        const map = new Map<string, LeaseResidentGroup>();
        leaseListState.items.forEach((lease) => {
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
    }, [leaseListState.items]);

    const openMoveInForResident = (resident?: OrgResidentListItem | null) => {
        if (!canOpenMoveIn) return;
        const params = new URLSearchParams();
        params.set("buildingId", selectedBuildingForActions);
        const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
        params.set("returnTo", returnTo);
        if (resident?.user.id) params.set("residentUserId", resident.user.id);
        if (resident?.user.name) params.set("residentName", resident.user.name);
        if (resident?.user.email) params.set("residentEmail", resident.user.email);
        router.push(`${leaseBasePath}/move-in?${params.toString()}`);
    };

    const openMoveOutForLease = (lease: Lease) => {
        setMoveOutContext({
            buildingId: lease.buildingId,
            leaseId: lease.id,
            unitId: lease.unitId || undefined,
            unitLabel: lease.unit?.label || lease.unitId || undefined,
            residentName: lease.resident?.name,
        });
    };

    const openTransferForLease = (lease: Lease) => {
        setTransferContext({
            buildingId: lease.buildingId,
            leaseId: lease.id,
            unitId: lease.unitId || undefined,
            unitLabel: lease.unit?.label || lease.unitId || undefined,
            residentUserId: lease.residentUserId || undefined,
            residentName: lease.resident?.name,
            residentEmail: lease.resident?.email,
        });
    };

    const closeTransfer = (open: boolean) => {
        if (!open) {
            setTransferContext(null);
        }
    };

    const closeMoveOut = (open: boolean) => {
        if (!open) {
            setMoveOutContext(null);
        }
    };

    const applyQuickFilter = (filter: "all" | "active" | "expiring_30d" | "ended_30d" | "pending") => {
        if (filter === "pending") {
            setActiveTab("pending");
            return;
        }
        if (filter === "all") {
            setActiveTab("leases");
            setStatus("ALL");
            setOrder("desc");
            setDateFromLocal("");
            setDateToLocal("");
            return;
        }
        if (filter === "active") {
            setActiveTab("leases");
            setStatus("ACTIVE");
            setOrder("desc");
            setDateFromLocal("");
            setDateToLocal("");
            return;
        }
        if (filter === "expiring_30d") {
            const now = new Date();
            const inThirtyDays = new Date(now);
            inThirtyDays.setDate(inThirtyDays.getDate() + 30);
            setActiveTab("leases");
            setStatus("ACTIVE");
            setOrder("asc");
            setDateFromLocal("");
            setDateToLocal(toDateTimeLocalFromDate(inThirtyDays));
            return;
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setActiveTab("leases");
        setStatus("ENDED");
        setOrder("desc");
        setDateFromLocal(toDateTimeLocalFromDate(thirtyDaysAgo));
        setDateToLocal("");
    };

    const resetLeaseFilters = () => {
        setStatus("ALL");
        setOrder("desc");
        setViewMode("flat");
        setSelectedBuildingId(ALL_BUILDINGS);
        setSearch("");
        setDateFromLocal("");
        setDateToLocal("");
    };

    const renderLeaseActionsMenu = (lease: Lease, contextLabel: string) => {
        const leaseActionIds = getLeaseActionIds(lease.status);
        const canMoveOut = leaseActionIds.includes("move_out");
        const canTransfer = leaseActionIds.includes("transfer");
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                        aria-label={`Lease actions for ${contextLabel}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link
                                href={`${leaseBasePath}/${lease.id}`}
                                onClick={(event) => event.stopPropagation()}
                        >
                            View
                        </Link>
                    </DropdownMenuItem>
                    {canWriteLease ? (
                        <DropdownMenuItem
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditLeaseContext(lease);
                            }}
                        >
                            Edit Lease
                        </DropdownMenuItem>
                    ) : null}
                    {canMoveOut ? (
                        <DropdownMenuItem
                            onClick={(event) => {
                                event.stopPropagation();
                                openMoveOutForLease(lease);
                            }}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Move Out
                        </DropdownMenuItem>
                    ) : null}
                    {canTransfer ? (
                        <DropdownMenuItem
                            onClick={(event) => {
                                event.stopPropagation();
                                openTransferForLease(lease);
                            }}
                        >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transfer
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const renderPendingResidentsTable = (residents: OrgResidentListItem[]) => {
        if (residents.length === 0) {
            return (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-6 text-center text-sm text-zinc-500">
                    No tenants in this section.
                </div>
            );
        }
        return (
            <div className="rounded-lg border border-zinc-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Resident</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Occupancy</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {residents.map((resident) => {
                            const residentStatus = resident.residentStatus ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
                            const occupancySummary = resident.lastOccupancy
                                ? `${resident.lastOccupancy.buildingName || "Unknown building"}${resident.lastOccupancy.unitLabel ? `, Unit ${resident.lastOccupancy.unitLabel}` : ""}`
                                : "No previous occupancy";
                            return (
                                <TableRow key={resident.user.id}>
                                    <TableCell className="text-sm text-zinc-700">
                                        <div>{resident.user.name || "-"}</div>
                                        <div className="text-xs text-zinc-500">{resident.user.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                residentStatus === "FORMER"
                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                            }
                                        >
                                            {residentStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-700">
                                        {occupancySummary}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => openMoveInForResident(resident)}
                                            disabled={!canOpenMoveIn}
                                            title={!canOpenMoveIn ? "Select a building to move in this resident." : undefined}
                                        >
                                            Move In
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Browse active and ended leases across your organization.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        onClick={() => openMoveInForResident(null)}
                        disabled={!canOpenMoveIn}
                        title={!canOpenMoveIn ? "Select a building to move in a tenant." : undefined}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Move In Tenant
                    </Button>
                        {!canOpenMoveIn ? (
                            <p className="self-center text-xs text-zinc-500">
                            Select a building to enable move-in.
                            </p>
                        ) : null}
                </div>
            </div>

            <div className="sticky top-2 z-20 rounded-2xl border border-zinc-200 bg-white/95 p-4 backdrop-blur">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Active Leases</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.active}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Ended Leases</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.ended}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Pending Move-In</div>
                        <div className="text-lg font-semibold text-zinc-900">{residentListState.items.length}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Rows In View</div>
                        <div className="text-lg font-semibold text-zinc-900">
                            {activeTab === "leases" ? leaseListState.items.length : residentListState.items.length}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeasePageTab)} className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <TabsList className="grid w-full max-w-lg grid-cols-2">
                        <TabsTrigger value="leases" aria-label="Show active and ended leases">
                            Active/Ended Leases
                        </TabsTrigger>
                        <TabsTrigger value="pending" aria-label="Show tenants waiting for move-in">
                            Pending Move-In Tenants
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="leases">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant={activeTab === "leases" && status === "ALL" && !dateFromLocal && !dateToLocal ? "default" : "outline"}
                        onClick={() => applyQuickFilter("all")}
                    >
                        All Leases
                    </Button>
                    <Button
                        size="sm"
                        variant={activeTab === "leases" && status === "ACTIVE" && !dateFromLocal && !dateToLocal ? "default" : "outline"}
                        onClick={() => applyQuickFilter("active")}
                    >
                        Active
                    </Button>
                    <Button
                        size="sm"
                        variant={activeTab === "leases" && status === "ACTIVE" && Boolean(dateToLocal) ? "default" : "outline"}
                        onClick={() => applyQuickFilter("expiring_30d")}
                    >
                        Active + Date To 30d
                    </Button>
                    <Button
                        size="sm"
                        variant={activeTab === "leases" && status === "ENDED" && Boolean(dateFromLocal) ? "default" : "outline"}
                        onClick={() => applyQuickFilter("ended_30d")}
                    >
                        Ended + Date From 30d
                    </Button>
                    <Button
                        size="sm"
                        variant={activeTab === "pending" ? "default" : "outline"}
                        onClick={() => applyQuickFilter("pending")}
                    >
                        Pending Move-In
                    </Button>
                </div>
                <p className="mb-4 text-xs text-zinc-500">
                    Quick filters use the same server-side date range fields shown below: <code>date_from</code> and <code>date_to</code>.
                </p>

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
                    {leasesQuery.isLoading && leaseListState.items.length === 0 ? (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-500">Loading leases...</p>
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                        </div>
                    ) : leasesQuery.isError && leaseListState.items.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                            <p>
                                {errorStatus === 404
                                    ? "The org-wide leases endpoint is not available yet (`GET /api/org/leases`)."
                                    : errorStatus === 401
                                        ? "Your session expired. Please sign in again."
                                        : errorStatus === 403
                                            ? "You do not have access to view org leases."
                                            : errorStatus === 400
                                                ? "Invalid filters. Check date range and filter values."
                                                : "Failed to load leases."}
                            </p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => leasesQuery.refetch()}>
                                Try again
                            </Button>
                        </div>
                    ) : leaseListState.items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            <p>
                                {hasLeaseFilters
                                    ? "No leases match the current filters."
                                    : "No leases found yet. Move in a tenant to create the first lease."}
                            </p>
                            {hasLeaseFilters ? (
                                <Button variant="outline" size="sm" className="mt-3" onClick={resetLeaseFilters}>
                                    Clear filters
                                </Button>
                            ) : null}
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
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leaseListState.items.map((lease) => (
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
                                                <TableCell className="text-right">
                                                    {renderLeaseActionsMenu(
                                                        lease,
                                                        `${lease.resident?.name || lease.resident?.email || "resident"} ${lease.unit?.label ? `Unit ${lease.unit.label}` : lease.unitId || ""}`.trim()
                                                    )}
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
                                                            <TableHead className="text-right">Actions</TableHead>
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
                                                                <TableCell className="text-right">
                                                                    {renderLeaseActionsMenu(
                                                                        lease,
                                                                        `${group.residentName} ${lease.unit?.label ? `Unit ${lease.unit.label}` : lease.unitId || ""}`.trim()
                                                                    )}
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

                    {leaseListState.nextCursor ? (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    dispatchLeaseList({
                                        type: "setCursor",
                                        cursor: leaseListState.nextCursor,
                                    })
                                }
                                disabled={leasesQuery.isFetching}
                            >
                                {leasesQuery.isFetching ? "Loading..." : "Load more"}
                            </Button>
                        </div>
                    ) : null}
                </div>
                </div>
                </TabsContent>

                <TabsContent value="pending">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">Tenants Without Active Lease</h2>
                        <p className="text-sm text-zinc-500">
                            Move in residents who are not currently in an active unit occupancy.
                        </p>
                        {!canOpenMoveIn ? (
                            <p className="mt-1 text-xs text-zinc-500">
                                Select a building below to enable move-in actions.
                            </p>
                        ) : null}
                    </div>
                    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                            <SelectTrigger className="w-full sm:w-[260px]">
                                <SelectValue placeholder="Select building for move-in" />
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
                        <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200" aria-live="polite">
                            {isPendingInitialLoading
                                ? "Loading tenants..."
                                : `${residentListState.items.length} tenant${residentListState.items.length === 1 ? "" : "s"}`}
                        </Badge>
                    </div>
                </div>

                {isPendingInitialLoading ? (
                    <div className="space-y-3">
                        <p className="text-xs text-zinc-500">Loading pending move-in tenants...</p>
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                ) : residentsWithoutActiveLeaseQuery.isError && residentListState.items.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                        <p>Failed to load tenants without active lease.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => residentsWithoutActiveLeaseQuery.refetch()}
                        >
                            Try again
                        </Button>
                    </div>
                ) : residentListState.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center text-sm text-zinc-500">
                        {trimmedSearch
                            ? "No tenants match your current search."
                            : "No tenants are currently waiting for move-in."}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-zinc-900">New Tenants</h3>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {pendingGroups.NEW.length}
                                </Badge>
                            </div>
                            {renderPendingResidentsTable(pendingGroups.NEW)}
                        </div>
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-zinc-900">Former Tenants</h3>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    {pendingGroups.FORMER.length}
                                </Badge>
                            </div>
                            {renderPendingResidentsTable(pendingGroups.FORMER)}
                        </div>
                        {pendingGroups.OTHER.length > 0 ? (
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-zinc-900">Other</h3>
                                    <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200">
                                        {pendingGroups.OTHER.length}
                                    </Badge>
                                </div>
                                {renderPendingResidentsTable(pendingGroups.OTHER)}
                            </div>
                        ) : null}
                    </div>
                )}

                {residentListState.nextCursor ? (
                    <div className="mt-4 flex justify-center">
                        <Button
                            variant="outline"
                            onClick={() =>
                                dispatchResidentList({
                                    type: "setCursor",
                                    cursor: residentListState.nextCursor,
                                })
                            }
                            disabled={residentsWithoutActiveLeaseQuery.isFetching}
                        >
                            {residentsWithoutActiveLeaseQuery.isFetching ? "Loading..." : "Load more"}
                        </Button>
                    </div>
                ) : null}
            </div>
                </TabsContent>
            </Tabs>

            {transferContext ? (
                <TransferUnitDialog
                    open={Boolean(transferContext)}
                    onOpenChange={closeTransfer}
                    buildingId={transferContext.buildingId}
                    defaultResidentUserId={transferContext.residentUserId}
                    defaultResidentName={transferContext.residentName}
                    defaultResidentEmail={transferContext.residentEmail}
                    transferFrom={{
                        leaseId: transferContext.leaseId,
                        unitId: transferContext.unitId,
                        unitLabel: transferContext.unitLabel,
                    }}
                />
            ) : null}

            {editLeaseContext && canWriteLease ? (
                <EditLeaseDialog
                    open={Boolean(editLeaseContext)}
                    onOpenChange={(open) => {
                        if (!open) setEditLeaseContext(null);
                    }}
                    lease={editLeaseContext}
                />
            ) : null}

            {moveOutContext ? (
                <MoveOutDialog
                    open={Boolean(moveOutContext)}
                    onOpenChange={closeMoveOut}
                    buildingId={moveOutContext.buildingId}
                    leaseId={moveOutContext.leaseId}
                    unitId={moveOutContext.unitId}
                    unitLabel={moveOutContext.unitLabel}
                    residentName={moveOutContext.residentName}
                />
            ) : null}
        </div>
    );
}
