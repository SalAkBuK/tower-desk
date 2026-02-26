"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTenantDialog } from "@/components/residents/CreateTenantDialog";
import { EditResidentDialog } from "@/components/residents/EditResidentDialog";
import { ResidentLeaseHistoryDialog } from "@/components/residents/ResidentLeaseHistoryDialog";
import { useResidentActions } from "@/components/residents/useResidentActions";
import { MoveInDialog } from "@/components/leases/MoveInDialog";
import { MoveOutDialog } from "@/components/leases/MoveOutDialog";
import { TransferUnitDialog } from "@/components/leases/TransferUnitDialog";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useOrgResidents,
    useResidentDirectory,
} from "@/lib/queries";
import type { OrgResidentListItem, OrgResidentsResponse, ResidentDirectoryRow, ResidentDirectoryResponse } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type StatusFilter = "ALL" | "WITH_OCCUPANCY" | "NEW" | "FORMER";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: "All Residents" },
    { value: "WITH_OCCUPANCY", label: "Active" },
    { value: "NEW", label: "Not Moved In" },
    { value: "FORMER", label: "Moved Out" },
];

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    WITH_OCCUPANCY: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    NEW: { label: "Not Moved In", className: "bg-blue-50 text-blue-700 border-blue-200" },
    FORMER: { label: "Moved Out", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
    WITH_OCCUPANCY: "No active residents found. Move in a tenant to get started.",
    NEW: "No residents are waiting to be moved in.",
    FORMER: "No former residents found.",
    ALL: "No residents found. Add a tenant to get started.",
};

const ALL_BUILDINGS = "__ALL__";

const DIRECTORY_STATUS_MAP: Record<StatusFilter, string | undefined> = {
    WITH_OCCUPANCY: "ACTIVE",
    FORMER: "ENDED",
    NEW: undefined,
    ALL: "ALL",
};

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

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

const mergeByUserId = (prev: OrgResidentListItem[], next: OrgResidentListItem[]) => {
    const map = new Map(prev.map((item) => [item.user.id, item]));
    next.forEach((item) => map.set(item.user.id, item));
    return Array.from(map.values());
};

const toComparableTime = (value?: string | null) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const pickPreferredDirectoryRow = (
    current: ResidentDirectoryRow | undefined,
    candidate: ResidentDirectoryRow
) => {
    if (!current) return candidate;

    const currentHasLease = Boolean(current.lease?.leaseId);
    const candidateHasLease = Boolean(candidate.lease?.leaseId);
    if (candidateHasLease && !currentHasLease) return candidate;
    if (!candidateHasLease && currentHasLease) return current;

    const currentTime = Math.max(
        toComparableTime(current.endAt),
        toComparableTime(current.lease?.leaseEndDate),
        toComparableTime(current.startAt)
    );
    const candidateTime = Math.max(
        toComparableTime(candidate.endAt),
        toComparableTime(candidate.lease?.leaseEndDate),
        toComparableTime(candidate.startAt)
    );
    return candidateTime > currentTime ? candidate : current;
};

const getCurrentOccupancySummary = (
    resident: OrgResidentListItem,
    directoryRow?: ResidentDirectoryRow | null,
    buildingName?: string
) => {
    const current = resident.activeOccupancy
        ?? (resident as any)?.currentOccupancy
        ?? (resident as any)?.activeOccupancy
        ?? (resident as any)?.occupancy
        ?? null;
    const currentBuilding = current?.buildingName ?? current?.building ?? "";
    const currentUnit = current?.unitLabel ?? current?.unit ?? "";
    if (currentBuilding || currentUnit) {
        const parts = [currentBuilding, currentUnit ? `Unit ${currentUnit}` : ""].filter(Boolean);
        return parts.join(", ");
    }
    if (directoryRow?.unitLabel) {
        const parts = [buildingName, `Unit ${directoryRow.unitLabel}`].filter(Boolean);
        return parts.join(", ");
    }
    return resident.hasActiveOccupancy ? "Active occupancy" : "No active occupancy";
};

const getFormerOccupancySummary = (resident: OrgResidentListItem) => {
    const last = resident.lastOccupancy;
    if (!last) return "No previous occupancy";
    const label = [last.buildingName, last.unitLabel ? `Unit ${last.unitLabel}` : ""]
        .filter(Boolean)
        .join(", ");
    const ended = last.endAt ? ` - ended ${formatDate(last.endAt)}` : "";
    return `${label || "Previous occupancy"}${ended}`;
};

const getActiveOccupancyContext = (
    resident: OrgResidentListItem,
    directoryRow?: ResidentDirectoryRow | null,
    fallbackBuildingId?: string
) => {
    const current = resident.activeOccupancy
        ?? (resident as any)?.currentOccupancy
        ?? (resident as any)?.activeOccupancy
        ?? (resident as any)?.occupancy
        ?? null;
    if (current?.unitId || current?.unit?.id) {
        return {
            buildingId: current?.buildingId ?? current?.building_id ?? current?.building?.id ?? fallbackBuildingId,
            unitId: current?.unitId ?? current?.unit_id ?? current?.unit?.id ?? undefined,
            unitLabel: current?.unitLabel ?? current?.unit?.label ?? current?.unit ?? undefined,
        };
    }
    if (directoryRow?.unitId) {
        return {
            buildingId: fallbackBuildingId,
            unitId: directoryRow.unitId ?? undefined,
            unitLabel: directoryRow.unitLabel ?? undefined,
        };
    }
    return null;
};

const getStatusDisplay = (resident: OrgResidentListItem) => {
    const status = resident.residentStatus ?? (resident.hasActiveOccupancy ? "ACTIVE" : "FORMER");
    return STATUS_DISPLAY[status] ?? STATUS_DISPLAY.ACTIVE;
};

const getOccupancySummary = (
    resident: OrgResidentListItem,
    directoryRow?: ResidentDirectoryRow | null,
    buildingName?: string
) => {
    const status = resident.residentStatus ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
    if (status === "ACTIVE") {
        return getCurrentOccupancySummary(resident, directoryRow, buildingName);
    }
    if (status === "FORMER") {
        return getFormerOccupancySummary(resident);
    }
    return "Not moved in yet";
};

const directoryRowToResident = (
    row: ResidentDirectoryRow,
    buildingId: string,
    buildingName: string
): OrgResidentListItem => {
    const normalized = (row.status ?? "").toUpperCase();
    const isActive = normalized === "ACTIVE";
    const isFormer = normalized === "FORMER" || normalized === "ENDED" || normalized === "MOVED_OUT";
    const resolvedStatus = isActive ? "ACTIVE" : isFormer ? "FORMER" : "NEW";

    return {
        user: {
            id: row.residentUserId,
            name: row.residentName ?? "",
            email: row.residentEmail ?? "",
            role: "tenant",
            buildingIds: [buildingId],
            phoneNumber: row.residentPhone ?? undefined,
            avatarUrl: row.residentAvatarUrl ?? undefined,
            createdAt: row.startAt ?? undefined,
        },
        hasActiveOccupancy: isActive,
        occupancyId: row.occupancyId,
        activeOccupancy: isActive
            ? { buildingId, unitId: row.unitId ?? "", unitLabel: row.unitLabel ?? null, buildingName }
            : null,
        residentStatus: resolvedStatus,
        lastOccupancy: isFormer
            ? { buildingName, unitLabel: row.unitLabel ?? "", endAt: row.endAt ?? null }
            : null,
        residentProfile: row.profile ?? null,
        lease: row.lease ?? null,
    };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrgResidentsPage({ title = "Residents" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const leaseBasePath = "/portal/leases";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [search, setSearch] = useState("");
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [leaseHistoryResident, setLeaseHistoryResident] = useState<OrgResidentListItem | null>(null);

    const buildingNameById = useMemo(() => {
        return (buildings || []).reduce<Record<string, string>>((acc, building) => {
            acc[building.id] = building.name;
            return acc;
        }, {});
    }, [buildings]);

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    const isAllBuildings = selectedBuildingId === ALL_BUILDINGS;
    const effectiveBuildingId = isAllBuildings ? "" : selectedBuildingId;

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    /* ------ Paginated queries ------ */

    const trimmedSearch = search.trim();
    const [cursor, setCursor] = useState<string | null>(null);
    const [residents, setResidents] = useState<OrgResidentListItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    useEffect(() => {
        setCursor(null);
        setResidents([]);
        setNextCursor(null);
    }, [trimmedSearch, statusFilter, selectedBuildingId]);

    /* Directory-backed rows include lease context; use it for Active + Moved Out when building is scoped */
    const useDirectory = !isAllBuildings && Boolean(effectiveBuildingId)
        && (statusFilter === "WITH_OCCUPANCY" || statusFilter === "FORMER");

    /* When using org-wide as primary but a building is selected, also fetch directory for enrichment (lease info, phone) */
    const needsEnrichment = !useDirectory && !isAllBuildings && Boolean(effectiveBuildingId);

    /* Org-wide query */
    const residentsQuery = useOrgResidents(
        {
            status: statusFilter,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: cursor ?? undefined,
            includeProfile: true,
        },
        { enabled: !useDirectory }
    );

    /* Building-specific directory query (primary data source for WITH_OCCUPANCY) */
    const directoryQuery = useResidentDirectory(effectiveBuildingId || "__noop__", {
        q: trimmedSearch || undefined,
        status: DIRECTORY_STATUS_MAP[statusFilter],
        limit: 50,
        cursor: cursor ?? undefined,
        includeProfile: true,
        enabled: useDirectory,
    });

    /* Enrichment-only directory query (fetches all statuses for lease/phone info) */
    const enrichmentQuery = useResidentDirectory(effectiveBuildingId || "__noop__", {
        status: "ALL",
        limit: 100,
        includeProfile: false,
        enabled: needsEnrichment,
    });

    const activeQuery = useDirectory ? directoryQuery : residentsQuery;

    /* Process org-wide results */
    useEffect(() => {
        if (useDirectory) return;
        const data = residentsQuery.data as OrgResidentsResponse | undefined;
        if (!data) return;
        setNextCursor(data.nextCursor ?? null);
        if (!cursor) {
            setResidents(data.items || []);
            return;
        }
        setResidents((prev) => mergeByUserId(prev, data.items || []));
    }, [residentsQuery.data, cursor, useDirectory, selectedBuildingId]);

    /* Process building-specific directory results */
    useEffect(() => {
        if (!useDirectory) return;
        const data = directoryQuery.data as ResidentDirectoryResponse | undefined;
        if (!data) return;
        const bName = buildingNameById[effectiveBuildingId] ?? "";
        const items = mergeByUserId(
            [],
            (data.items || []).map((row) =>
                directoryRowToResident(row, effectiveBuildingId, bName)
            )
        );
        setNextCursor(data.nextCursor ?? null);
        if (!cursor) {
            setResidents(items);
            return;
        }
        setResidents((prev) => mergeByUserId(prev, items));
    }, [directoryQuery.data, cursor, useDirectory, effectiveBuildingId, buildingNameById]);

    /* ------ Directory enrichment map (for lease info, phone) ------ */

    const residentDirectoryByUserId = useMemo(() => {
        const map = new Map<string, ResidentDirectoryRow>();
        const items = useDirectory
            ? (directoryQuery.data?.items || [])
            : (enrichmentQuery.data?.items || []);
        items.forEach((row) => {
            if (!row.residentUserId) return;
            const existing = map.get(row.residentUserId);
            map.set(row.residentUserId, pickPreferredDirectoryRow(existing, row));
        });
        return map;
    }, [directoryQuery.data, enrichmentQuery.data, useDirectory]);

    /* ------ Actions hook ------ */

    const actions = useResidentActions({
        selectedBuildingId: effectiveBuildingId,
        residentDirectoryByUserId,
        getActiveOccupancyContext,
    });

    /* ------ Render ------ */

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Manage resident profiles and occupancy status across your organization.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                            <SelectTrigger className="w-60">
                                <SelectValue placeholder="Select building" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_BUILDINGS}>All Buildings</SelectItem>
                                {buildingOptions.map((building) => (
                                    <SelectItem key={building.id} value={building.id}>
                                        {building.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => setIsAddTenantOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Tenant
                        </Button>
                        <Button onClick={() => actions.openMoveInDialog(null)} disabled={!effectiveBuildingId}>
                            <UserRound className="mr-2 h-4 w-4" /> Move In Tenant
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900">Residents</h2>
                        <p className="text-xs text-zinc-400">Browse and manage all residents.</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                placeholder="Search residents..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mt-6">
                    {activeQuery.isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="rounded-lg border border-zinc-200 bg-white p-4">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="mt-2 h-3 w-1/2" />
                                    <Skeleton className="mt-3 h-3 w-2/3" />
                                </div>
                            ))}
                        </div>
                    ) : residents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            {EMPTY_MESSAGES[statusFilter]}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-zinc-200 bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Resident</TableHead>
                                        <TableHead>Occupancy</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {residents.map((resident) => {
                                        const statusDisplay = getStatusDisplay(resident);
                                        const directoryRow = residentDirectoryByUserId.get(resident.user.id);
                                        const occupancy = getOccupancySummary(
                                            resident,
                                            directoryRow,
                                            buildingNameById[effectiveBuildingId]
                                        );
                                        const lease = directoryRow?.lease ?? resident.lease ?? null;
                                        const hasLeaseDates = Boolean(lease?.leaseStartDate || lease?.leaseEndDate);
                                        const leaseSummary = hasLeaseDates
                                            ? `${formatDate(lease?.leaseStartDate)} -> ${formatDate(lease?.leaseEndDate)}`
                                            : "";
                                        const leaseId = lease?.leaseId;
                                        const canViewLease = Boolean(leaseBasePath && leaseId);
                                        const residentStatus = resident.residentStatus
                                            ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
                                        const isActive = residentStatus === "ACTIVE";
                                        const isLoadingLease = actions.moveOutLoadingId === resident.user.id;

                                        return (
                                            <TableRow key={resident.user.id}>
                                                <TableCell>
                                                    <div className="text-sm font-medium text-zinc-900">
                                                        {resident.user.name}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">
                                                        {resident.user.email}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-700">
                                                    <div>{occupancy}</div>
                                                    {(leaseSummary || canViewLease) ? (
                                                        <div className="text-xs text-zinc-500">
                                                            {isActive ? "Lease" : "Last lease"}{leaseSummary ? `: ${leaseSummary}` : ""}
                                                            {canViewLease ? (
                                                                <>
                                                                    {" | "}
                                                                    <Link
                                                                        href={`${leaseBasePath}/${leaseId}`}
                                                                        className="text-blue-600 hover:underline"
                                                                    >
                                                                        View lease
                                                                    </Link>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={statusDisplay.className}
                                                    >
                                                        {statusDisplay.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600">
                                                    {resident.user.phoneNumber || directoryRow?.residentPhone || "-"}
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600">
                                                    {formatDate(resident.user.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                                                                aria-label="Resident actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => actions.setEditResident(resident)}
                                                            >
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setLeaseHistoryResident(resident)}
                                                            >
                                                                Lease History
                                                            </DropdownMenuItem>
                                                            {canViewLease && (
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`${leaseBasePath}/${leaseId}`}>
                                                                        View Lease
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            )}
                                                            {isActive ? (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        onClick={() => actions.openMoveOutDialog(resident)}
                                                                        disabled={isLoadingLease}
                                                                    >
                                                                        {isLoadingLease ? "Loading..." : "Move Out"}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => actions.openTransferDialog(resident)}
                                                                        disabled={isLoadingLease}
                                                                    >
                                                                        {isLoadingLease ? "Loading lease..." : "Transfer Unit"}
                                                                    </DropdownMenuItem>
                                                                </>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    onClick={() => actions.openMoveInDialog(resident)}
                                                                    disabled={!effectiveBuildingId}
                                                                >
                                                                    Move In
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {nextCursor ? (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() => setCursor(nextCursor)}
                                disabled={activeQuery.isFetching}
                            >
                                {activeQuery.isFetching ? "Loading..." : "Load more"}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Dialogs */}
            <EditResidentDialog
                resident={actions.editResident}
                selectedBuildingId={effectiveBuildingId}
                onClose={() => actions.setEditResident(null)}
            />

            <CreateTenantDialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen} />

            {effectiveBuildingId && (actions.moveInResident || actions.isMoveInOpen) ? (
                actions.transferContext && actions.moveInResident ? (
                    <TransferUnitDialog
                        open={Boolean(actions.moveInResident)}
                        onOpenChange={(open) => {
                            if (!open) actions.closeTransfer();
                        }}
                        buildingId={actions.transferContext.buildingId}
                        defaultResidentUserId={actions.moveInResident.user.id}
                        defaultResidentName={actions.moveInResident.user.name}
                        defaultResidentEmail={actions.moveInResident.user.email}
                        transferFrom={{
                            leaseId: actions.transferContext.leaseId,
                            unitId: actions.transferContext.unitId,
                            unitLabel: actions.transferContext.unitLabel,
                        }}
                    />
                ) : (
                    <MoveInDialog
                        open={Boolean(actions.moveInResident) || actions.isMoveInOpen}
                        onOpenChange={actions.closeMoveIn}
                        buildingId={effectiveBuildingId}
                        defaultResidentUserId={actions.moveInResident?.user.id}
                        defaultResidentName={actions.moveInResident?.user.name}
                        defaultResidentEmail={actions.moveInResident?.user.email}
                    />
                )
            ) : null}

            {actions.moveOutContext ? (
                <MoveOutDialog
                    open={Boolean(actions.moveOutContext)}
                    onOpenChange={actions.closeMoveOut}
                    buildingId={actions.moveOutContext.buildingId}
                    leaseId={actions.moveOutContext.leaseId}
                    unitId={actions.moveOutContext.unitId}
                    unitLabel={actions.moveOutContext.unitLabel}
                    residentName={actions.moveOutContext.resident.user.name}
                />
            ) : null}

            <ResidentLeaseHistoryDialog
                open={Boolean(leaseHistoryResident)}
                onOpenChange={(open) => {
                    if (!open) setLeaseHistoryResident(null);
                }}
                residentUserId={leaseHistoryResident?.user.id}
                residentName={leaseHistoryResident?.user.name}
                residentEmail={leaseHistoryResident?.user.email}
                leaseBasePath={leaseBasePath || undefined}
            />
        </div>
    );
}
