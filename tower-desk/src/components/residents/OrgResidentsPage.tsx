"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { FileText, MoreHorizontal, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ResidentInviteMonitor } from "@/components/residents/ResidentInviteMonitor";
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
import { useAuth } from "@/lib/auth";
import {
    buildLeasesHref,
    resolveLeasesLandingTabFromResidentFilter,
    resolveResidentLeaseModuleHref,
} from "@/lib/leaseNavigation";
import { isOrganizationAdminRole } from "@/lib/roles";
import {
    useAccessibleBuildings,
    useOrgResidents,
    useResendResidentInvite,
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
    WITH_OCCUPANCY: "No active residents found.",
    NEW: "No residents are waiting to be moved in.",
    FORMER: "No former residents found.",
    ALL: "No residents found. Add a tenant to get started.",
};

const ALL_BUILDINGS = "__ALL__";

const DIRECTORY_STATUS_MAP: Record<StatusFilter, string | undefined> = {
    WITH_OCCUPANCY: "ACTIVE",
    FORMER: "ENDED",
    NEW: "ALL",
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

interface ResidentCursorState {
    cursor: string | null;
    items: OrgResidentListItem[];
    nextCursor: string | null;
}

type ResidentCursorAction =
    | { type: "reset" }
    | { type: "setCursor"; cursor: string | null }
    | { type: "append"; cursor: string | null; items: OrgResidentListItem[]; nextCursor: string | null };

const initialResidentCursorState = (): ResidentCursorState => ({
    cursor: null,
    items: [],
    nextCursor: null,
});

const residentCursorReducer = (
    state: ResidentCursorState,
    action: ResidentCursorAction
): ResidentCursorState => {
    switch (action.type) {
        case "reset":
            return initialResidentCursorState();
        case "setCursor":
            return {
                ...state,
                cursor: action.cursor,
            };
        case "append":
            return {
                cursor: state.cursor,
                nextCursor: action.nextCursor,
                items: action.cursor ? mergeByUserId(state.items, action.items) : action.items,
            };
        default:
            return state;
    }
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
    const legacyResident = resident as OrgResidentListItem & {
        currentOccupancy?: {
            buildingName?: string | null;
            building?: string | null;
            unitLabel?: string | null;
            unit?: string | null;
        } | null;
        occupancy?: {
            buildingName?: string | null;
            building?: string | null;
            unitLabel?: string | null;
            unit?: string | null;
        } | null;
    };
    const current = resident.activeOccupancy
        ?? legacyResident.currentOccupancy
        ?? legacyResident.occupancy
        ?? null;
    const currentBuilding =
        current?.buildingName
        ?? (current && "building" in current ? current.building : undefined)
        ?? "";
    const currentUnit =
        current?.unitLabel
        ?? (current && "unit" in current ? current.unit : undefined)
        ?? "";
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
        latestContractId: row.latestContractId ?? null,
        canAddContract: row.canAddContract,
        canViewContract: row.canViewContract,
        canRequestMoveIn: row.canRequestMoveIn,
        canRequestMoveOut: row.canRequestMoveOut,
        canExecuteMoveOut: row.canExecuteMoveOut,
    };
};

const matchesStatusFilter = (resident: OrgResidentListItem, filter: StatusFilter) => {
    if (filter === "ALL") return true;
    const status = resident.residentStatus ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
    if (filter === "WITH_OCCUPANCY") return status === "ACTIVE";
    if (filter === "FORMER") return status === "FORMER";
    return status === "NEW";
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrgResidentsPage({ title = "Residents" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const canQueryOrgResidents = isOrganizationAdminRole(baseRole);
    const leaseBasePath = "/portal/contracts";
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole);
    const buildings = accessibleBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [search, setSearch] = useState("");
    const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
    const [editResident, setEditResident] = useState<OrgResidentListItem | null>(null);
    const [leaseHistoryResident, setLeaseHistoryResident] = useState<OrgResidentListItem | null>(null);
    const [resendInviteResident, setResendInviteResident] = useState<OrgResidentListItem | null>(null);
    const [residentState, dispatchResidentState] = useReducer(
        residentCursorReducer,
        undefined,
        initialResidentCursorState
    );
    const resendInviteMutation = useResendResidentInvite();

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

    const resolvedSelectedBuildingId =
        canQueryOrgResidents && selectedBuildingId === ALL_BUILDINGS
            ? ALL_BUILDINGS
            : selectedBuildingId || buildingOptions[0]?.id || (canQueryOrgResidents ? ALL_BUILDINGS : "");
    const isAllBuildings = resolvedSelectedBuildingId === ALL_BUILDINGS;
    const effectiveBuildingId = isAllBuildings ? "" : resolvedSelectedBuildingId;
    const leasesLandingTab = resolveLeasesLandingTabFromResidentFilter(statusFilter);
    const leasesLandingHref = useMemo(() => {
        return buildLeasesHref({
            basePath: leaseBasePath,
            buildingId: effectiveBuildingId || undefined,
            tab: leasesLandingTab,
        });
    }, [effectiveBuildingId, leaseBasePath, leasesLandingTab]);
    const moveOutExecutionQueueHref = useMemo(() => {
        const params = new URLSearchParams();
        params.set("tab", "pending");
        params.set("queue", "move-out");
        params.set("requestStatus", "APPROVED");
        if (effectiveBuildingId) {
            params.set("buildingId", effectiveBuildingId);
        }
        return `${leaseBasePath}?${params.toString()}`;
    }, [effectiveBuildingId, leaseBasePath]);

    /* ------ Paginated queries ------ */

    const trimmedSearch = search.trim();

    useEffect(() => {
        dispatchResidentState({ type: "reset" });
    }, [trimmedSearch, statusFilter, resolvedSelectedBuildingId]);

    /* Directory-backed rows include lease/contract capabilities; use it for building-scoped status filters */
    const useDirectory = Boolean(effectiveBuildingId)
        && (
            !canQueryOrgResidents
            || (statusFilter === "WITH_OCCUPANCY" || statusFilter === "FORMER" || statusFilter === "NEW")
        );

    /* When using org-wide as primary but a building is selected, also fetch directory for enrichment (lease info, phone) */
    const needsEnrichment = canQueryOrgResidents && !useDirectory && !isAllBuildings && Boolean(effectiveBuildingId);

    /* Org-wide query */
    const residentsQuery = useOrgResidents(
        {
            status: statusFilter,
            q: trimmedSearch || undefined,
            limit: 50,
            cursor: residentState.cursor ?? undefined,
            includeProfile: true,
        },
        { enabled: canQueryOrgResidents && !useDirectory }
    );

    /* Building-specific directory query (primary data source for WITH_OCCUPANCY) */
    const directoryQuery = useResidentDirectory(effectiveBuildingId || "__noop__", {
        q: trimmedSearch || undefined,
        status: DIRECTORY_STATUS_MAP[statusFilter],
        limit: 50,
        cursor: residentState.cursor ?? undefined,
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
        dispatchResidentState({
            type: "append",
            cursor: residentState.cursor,
            items: data.items || [],
            nextCursor: data.nextCursor ?? null,
        });
    }, [residentsQuery.data, residentState.cursor, useDirectory, resolvedSelectedBuildingId]);

    /* Process building-specific directory results */
    useEffect(() => {
        if (!useDirectory) return;
        const data = directoryQuery.data as ResidentDirectoryResponse | undefined;
        if (!data) return;
        const bName = buildingNameById[effectiveBuildingId] ?? "";
        const mapped = (data.items || []).map((row) =>
            directoryRowToResident(row, effectiveBuildingId, bName)
        );
        const items = mergeByUserId(
            [],
            mapped.filter((resident) => matchesStatusFilter(resident, statusFilter))
        );
        dispatchResidentState({
            type: "append",
            cursor: residentState.cursor,
            items,
            nextCursor: data.nextCursor ?? null,
        });
    }, [directoryQuery.data, residentState.cursor, useDirectory, effectiveBuildingId, buildingNameById, statusFilter]);

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

    const handleConfirmResendInvite = async () => {
        if (!resendInviteResident?.user.id) return;
        try {
            await resendInviteMutation.mutateAsync(resendInviteResident.user.id);
            toast.success("Invite sent.");
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to send invite.";
            toast.error(message);
        } finally {
            setResendInviteResident(null);
        }
    };

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
                        <Select value={resolvedSelectedBuildingId} onValueChange={setSelectedBuildingId}>
                            <SelectTrigger className="w-60">
                                <SelectValue placeholder="Select building" />
                            </SelectTrigger>
                            <SelectContent>
                                {canQueryOrgResidents ? <SelectItem value={ALL_BUILDINGS}>All Buildings</SelectItem> : null}
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
                        <Button asChild>
                            <Link href={leasesLandingHref}>
                                <FileText className="mr-2 h-4 w-4" /> Open Contracts
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            <ResidentInviteMonitor />

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
                    ) : residentState.items.length === 0 ? (
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
                                        <TableHead>Resident Status</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {residentState.items.map((resident) => {
                                        const statusDisplay = getStatusDisplay(resident);
                                        const canResendInvite = resident.user.isActive !== false;
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
                                        const leaseId =
                                            directoryRow?.latestContractId
                                            ?? resident.latestContractId
                                            ?? lease?.leaseId
                                            ?? null;
                                        const canViewLease = Boolean(
                                            leaseBasePath &&
                                            leaseId &&
                                            (directoryRow?.canViewContract
                                                ?? resident.canViewContract
                                                ?? true)
                                        );
                                        const canRequestMoveIn = Boolean(
                                            directoryRow?.canRequestMoveIn
                                            ?? resident.canRequestMoveIn
                                        );
                                        const canRequestMoveOut = Boolean(
                                            directoryRow?.canRequestMoveOut
                                            ?? resident.canRequestMoveOut
                                        );
                                        const canExecuteMoveOut = Boolean(
                                            directoryRow?.canExecuteMoveOut
                                            ?? resident.canExecuteMoveOut
                                        );
                                        const residentStatus = resident.residentStatus
                                            ?? (resident.hasActiveOccupancy ? "ACTIVE" : "NEW");
                                        const isActive = residentStatus === "ACTIVE";
                                        const residentQuery = (
                                            resident.user.email ||
                                            resident.user.name ||
                                            resident.user.id
                                        ).trim();
                                        const leaseModuleHref = resolveResidentLeaseModuleHref({
                                            leaseBasePath,
                                            effectiveBuildingId,
                                            residentQuery,
                                            residentStatus,
                                        });

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
                                                            {isActive ? "Contract" : "Last contract"}{leaseSummary ? `: ${leaseSummary}` : ""}
                                                            {canViewLease ? (
                                                                <>
                                                                    {" | "}
                                                                    <Link
                                                                        href={`${leaseBasePath}/${leaseId}`}
                                                                        className="text-blue-600 hover:underline"
                                                                    >
                                                                        View contract
                                                                    </Link>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                    {(canRequestMoveIn || canRequestMoveOut || canExecuteMoveOut) ? (
                                                        <div className="text-xs text-zinc-500">
                                                            {canRequestMoveIn ? "Move-In Request Enabled" : null}
                                                            {canRequestMoveIn && canRequestMoveOut ? " | " : null}
                                                            {canRequestMoveOut ? "Move-Out Request Enabled" : null}
                                                            {(canRequestMoveIn || canRequestMoveOut) && canExecuteMoveOut ? " | " : null}
                                                            {canExecuteMoveOut ? "Move-Out Execute Ready" : null}
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
                                                                onClick={() => setEditResident(resident)}
                                                            >
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setLeaseHistoryResident(resident)}
                                                            >
                                                                Contract History
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                disabled={!canResendInvite || resendInviteMutation.isPending}
                                                                onClick={() => setResendInviteResident(resident)}
                                                            >
                                                                Resend Invite
                                                            </DropdownMenuItem>
                                                            {canViewLease ? (
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`${leaseBasePath}/${leaseId}`}>
                                                                        View Contract
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            <DropdownMenuItem asChild>
                                                                <Link href={leaseModuleHref}>
                                                                    Open Contracts
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            {canExecuteMoveOut ? (
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={moveOutExecutionQueueHref}>
                                                                        Execute Move-Out
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {canRequestMoveIn ? (
                                                                <DropdownMenuItem disabled>
                                                                    Move-In Request Enabled
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            {canRequestMoveOut ? (
                                                                <DropdownMenuItem disabled>
                                                                    Move-Out Request Enabled
                                                                </DropdownMenuItem>
                                                            ) : null}
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

                    {residentState.nextCursor ? (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    dispatchResidentState({
                                        type: "setCursor",
                                        cursor: residentState.nextCursor,
                                    })
                                }
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
                resident={editResident}
                selectedBuildingId={effectiveBuildingId}
                onClose={() => setEditResident(null)}
            />

            <CreateTenantDialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen} />

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

            <ConfirmDialog
                open={Boolean(resendInviteResident)}
                onOpenChange={(open) => {
                    if (!open) {
                        setResendInviteResident(null);
                    }
                }}
                title="Resend onboarding invite"
                description={`Resend onboarding invite to ${resendInviteResident?.user.email ?? "this resident"}? This sends a new setup-password link.`}
                confirmText={resendInviteMutation.isPending ? "Sending..." : "Send onboarding invite"}
                onConfirm={() => {
                    void handleConfirmResendInvite();
                }}
            />
        </div>
    );
}
