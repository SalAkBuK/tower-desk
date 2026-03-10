"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import {
    useActivateContract,
    useAdminBuildings,
    useApproveMoveInRequest,
    useApproveMoveOutRequest,
    useCancelContract,
    useCreateMoveInRequest,
    useCreateMoveOutRequest,
    useExecuteMoveIn,
    useExecuteMoveOut,
    useLatestContractForResident,
    useManagerBuildings,
    useMoveInRequests,
    useMoveOutRequests,
    useOrgLeases,
    useRejectMoveInRequest,
    useRejectMoveOutRequest,
} from "@/lib/queries";
import { AddContractDialog } from "@/components/leases/AddContractDialog";
import { EditLeaseDialog } from "@/components/leases/EditLeaseDialog";
import type {
    ContractMoveRequest,
    ContractMoveRequestStatusFilter,
    Lease,
    OrgLeaseStatusFilter,
    TimelineOrder,
} from "@/lib/types";

interface OrgLeasesPageProps {
    title?: string;
}

const ALL_BUILDINGS = "__ALL__";
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
type LeaseViewMode = "flat" | "grouped";
type LeasePageTab = "leases" | "pending";
type MoveRequestType = "move-in" | "move-out";
type PendingQueueType = "move-in" | "move-out";

interface RejectRequestContext {
    requestId: string;
    requestType: PendingQueueType;
}

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
    value === "ALL" || value === "DRAFT" || value === "ACTIVE" || value === "ENDED" || value === "CANCELLED";

const isTimelineOrder = (value: string | null): value is TimelineOrder =>
    value === "asc" || value === "desc";

const isLeaseViewMode = (value: string | null): value is LeaseViewMode =>
    value === "flat" || value === "grouped";

const isLeasePageTab = (value: string | null): value is LeasePageTab =>
    value === "leases" || value === "pending";

const isPendingQueueType = (value: string | null): value is PendingQueueType =>
    value === "move-in" || value === "move-out";

const isContractMoveRequestStatusFilter = (value: string | null): value is ContractMoveRequestStatusFilter =>
    value === "PENDING"
    || value === "APPROVED"
    || value === "REJECTED"
    || value === "CANCELLED"
    || value === "COMPLETED"
    || value === "ALL";

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

const formatDateTime = (value?: string | null) => {
    if (!value) return "N/A";
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

const getStatusBadgeClassName = (status: Lease["status"]) => {
    if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "DRAFT") return "bg-blue-50 text-blue-700 border-blue-200";
    if (status === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

const getMoveRequestStatusBadgeClassName = (status: ContractMoveRequest["status"]) => {
    if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "APPROVED") return "bg-blue-50 text-blue-700 border-blue-200";
    if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "REJECTED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

export function OrgLeasesPage({ title = "Contracts" }: OrgLeasesPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, baseRole } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canWriteLease =
        hasPermission(permissionSet, "contracts.write") ||
        hasPermissionPrefix(permissionSet, "contracts.write") ||
        hasPermissionPrefix(permissionSet, "contracts") ||
        hasPermission(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases");
    const isManager = baseRole === "manager";
    const isTenant = baseRole === "tenant";
    const leaseBasePath = "/portal/contracts";

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
    const [addContractOpen, setAddContractOpen] = useState(false);
    const [moveRequestType, setMoveRequestType] = useState<MoveRequestType | null>(null);
    const [requestedMoveAtLocal, setRequestedMoveAtLocal] = useState("");
    const [moveRequestNotes, setMoveRequestNotes] = useState("");
    const [pendingQueueType, setPendingQueueType] = useState<PendingQueueType>(() => {
        const param = searchParams.get("queue");
        return isPendingQueueType(param) ? param : "move-in";
    });
    const [pendingRequestStatus, setPendingRequestStatus] = useState<ContractMoveRequestStatusFilter>(() => {
        const param = searchParams.get("requestStatus");
        return isContractMoveRequestStatusFilter(param) ? param : "PENDING";
    });
    const [rejectRequestContext, setRejectRequestContext] = useState<RejectRequestContext | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const effectiveBuildingId = selectedBuildingId === ALL_BUILDINGS ? undefined : selectedBuildingId;
    const trimmedSearch = search.trim();
    const selectedBuildingForActions = effectiveBuildingId ?? "";
    const canCreateContract = canWriteLease && Boolean(selectedBuildingForActions);
    const canSeePendingTab = canWriteLease && !isTenant;
    const resolvedActiveTab: LeasePageTab = canSeePendingTab ? activeTab : "leases";
    const canManageMoveRequests = canSeePendingTab && Boolean(effectiveBuildingId);
    const activateContractMutation = useActivateContract();
    const cancelContractMutation = useCancelContract();
    const createMoveInRequestMutation = useCreateMoveInRequest();
    const createMoveOutRequestMutation = useCreateMoveOutRequest();
    const approveMoveInRequestMutation = useApproveMoveInRequest();
    const rejectMoveInRequestMutation = useRejectMoveInRequest();
    const approveMoveOutRequestMutation = useApproveMoveOutRequest();
    const rejectMoveOutRequestMutation = useRejectMoveOutRequest();
    const executeMoveInMutation = useExecuteMoveIn();
    const executeMoveOutMutation = useExecuteMoveOut();
    const latestContractForResidentQuery = useLatestContractForResident(
        isTenant ? user?.id : undefined,
        { enabled: isTenant && Boolean(user?.id) }
    );
    const latestResidentContract = latestContractForResidentQuery.data ?? null;
    const canTenantRequestMoveIn = Boolean(
        latestResidentContract
            && latestResidentContract.status === "ACTIVE"
            && !latestResidentContract.occupancyId
    );
    const canTenantRequestMoveOut = Boolean(
        latestResidentContract
            && latestResidentContract.status === "ACTIVE"
            && Boolean(latestResidentContract.occupancyId)
    );
    const moveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        pendingRequestStatus,
        { enabled: canManageMoveRequests }
    );
    const moveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        pendingRequestStatus,
        { enabled: canManageMoveRequests }
    );
    const activeMoveRequestsQuery = pendingQueueType === "move-in" ? moveInRequestsQuery : moveOutRequestsQuery;
    const activeMoveRequests = activeMoveRequestsQuery.data ?? [];
    const leaseById = useMemo(() => {
        const map = new Map<string, Lease>();
        leaseListState.items.forEach((lease) => {
            map.set(lease.id, lease);
        });
        return map;
    }, [leaseListState.items]);
    const hasLeaseFilters =
        status !== "ALL" ||
        selectedBuildingId !== ALL_BUILDINGS ||
        Boolean(trimmedSearch) ||
        Boolean(dateFromLocal) ||
        Boolean(dateToLocal);
    const leaseCounts = useMemo(() => {
        let active = 0;
        let draft = 0;
        let ended = 0;
        let cancelled = 0;
        leaseListState.items.forEach((lease) => {
            if (lease.status === "ACTIVE") active += 1;
            else if (lease.status === "DRAFT") draft += 1;
            else if (lease.status === "CANCELLED") cancelled += 1;
            else ended += 1;
        });
        return {
            active,
            draft,
            ended,
            cancelled,
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
        if (resolvedActiveTab === "leases") nextParams.delete("tab");
        else nextParams.set("tab", resolvedActiveTab);
        if (selectedBuildingId === ALL_BUILDINGS) nextParams.delete("buildingId");
        else nextParams.set("buildingId", selectedBuildingId);
        if (trimmedSearch) nextParams.set("q", trimmedSearch);
        else nextParams.delete("q");
        if (dateFromLocal) nextParams.set("date_from", dateFromLocal);
        else nextParams.delete("date_from");
        if (dateToLocal) nextParams.set("date_to", dateToLocal);
        else nextParams.delete("date_to");
        if (!canSeePendingTab) {
            nextParams.delete("queue");
            nextParams.delete("requestStatus");
        } else {
            if (pendingQueueType === "move-in") nextParams.delete("queue");
            else nextParams.set("queue", pendingQueueType);
            if (pendingRequestStatus === "PENDING") nextParams.delete("requestStatus");
            else nextParams.set("requestStatus", pendingRequestStatus);
        }

        const nextQuery = nextParams.toString();
        const currentQuery = searchParams.toString();
        if (nextQuery !== currentQuery) {
            router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
        }
    }, [
        status,
        order,
        viewMode,
        resolvedActiveTab,
        canSeePendingTab,
        pendingQueueType,
        pendingRequestStatus,
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

    const activateContract = async (lease: Lease) => {
        try {
            await activateContractMutation.mutateAsync({ contractId: lease.id });
            toast.success("Contract activated.");
        } catch (error) {
            const status = toErrorStatus(error);
            if (status === 409) {
                toast.error("Contract cannot be activated due to a data conflict.");
                return;
            }
            const message = error instanceof Error ? error.message : "Failed to activate contract";
            toast.error(message);
        }
    };

    const cancelContract = async (lease: Lease) => {
        try {
            await cancelContractMutation.mutateAsync({ contractId: lease.id });
            toast.success("Contract cancelled.");
        } catch (error) {
            const status = toErrorStatus(error);
            if (status === 409) {
                toast.error("Contract cannot be cancelled due to a data conflict.");
                return;
            }
            const message = error instanceof Error ? error.message : "Failed to cancel contract";
            toast.error(message);
        }
    };

    const closeMoveRequestDialog = (open: boolean) => {
        if (!open) {
            setMoveRequestType(null);
            setMoveRequestNotes("");
            setRequestedMoveAtLocal("");
        }
    };

    const closeRejectDialog = (open: boolean) => {
        if (!open) {
            setRejectRequestContext(null);
            setRejectionReason("");
        }
    };

    const openMoveRequestDialog = (type: MoveRequestType) => {
        setMoveRequestType(type);
        setMoveRequestNotes("");
        setRequestedMoveAtLocal(toDateTimeLocalFromDate(new Date()));
    };

    const submitMoveRequest = async () => {
        if (!moveRequestType) return;
        if (!latestResidentContract?.id) {
            toast.error("No active contract available for this request.");
            return;
        }
        const requestedMoveAt = toIsoOrUndefined(requestedMoveAtLocal);
        if (!requestedMoveAt) {
            toast.error("Please select a valid requested move date and time.");
            return;
        }
        const notes = moveRequestNotes.trim();
        const dto = {
            requestedMoveAt,
            notes: notes || undefined,
        };
        try {
            if (moveRequestType === "move-in") {
                await createMoveInRequestMutation.mutateAsync({
                    contractId: latestResidentContract.id,
                    dto,
                });
                toast.success("Move-in request submitted.");
            } else {
                await createMoveOutRequestMutation.mutateAsync({
                    contractId: latestResidentContract.id,
                    dto,
                });
                toast.success("Move-out request submitted.");
            }
            await latestContractForResidentQuery.refetch();
            closeMoveRequestDialog(false);
        } catch (error) {
            const status = toErrorStatus(error);
            if (status === 400) {
                toast.error("Invalid move request details. Please review and try again.");
                return;
            }
            if (status === 409) {
                toast.error("Move request is not allowed for the current contract/occupancy state.");
                return;
            }
            const message = error instanceof Error ? error.message : "Failed to submit move request";
            toast.error(message);
        }
    };

    const approveRequest = async (request: ContractMoveRequest, requestType: PendingQueueType) => {
        try {
            if (requestType === "move-in") {
                await approveMoveInRequestMutation.mutateAsync({ requestId: request.id });
                toast.success("Move-in request approved.");
            } else {
                await approveMoveOutRequestMutation.mutateAsync({ requestId: request.id });
                toast.success("Move-out request approved.");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to approve request";
            toast.error(message);
        }
    };

    const rejectRequest = async () => {
        if (!rejectRequestContext) return;
        const reason = rejectionReason.trim();
        const dto = reason ? { rejectionReason: reason } : undefined;
        try {
            if (rejectRequestContext.requestType === "move-in") {
                await rejectMoveInRequestMutation.mutateAsync({
                    requestId: rejectRequestContext.requestId,
                    dto,
                });
                toast.success("Move-in request rejected.");
            } else {
                await rejectMoveOutRequestMutation.mutateAsync({
                    requestId: rejectRequestContext.requestId,
                    dto,
                });
                toast.success("Move-out request rejected.");
            }
            setRejectRequestContext(null);
            setRejectionReason("");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to reject request";
            toast.error(message);
        }
    };

    const executeRequest = async (request: ContractMoveRequest, requestType: PendingQueueType) => {
        const contractId = request.contractId || request.leaseId;
        if (!contractId) {
            toast.error("Request does not include a contract identifier.");
            return;
        }
        try {
            if (requestType === "move-in") {
                await executeMoveInMutation.mutateAsync({ contractId });
                toast.success("Move-in executed.");
            } else {
                await executeMoveOutMutation.mutateAsync({ contractId });
                toast.success("Move-out executed.");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to execute request";
            toast.error(message);
        }
    };

    const applyQuickFilter = (filter: "all" | "active" | "expiring_30d" | "ended_30d" | "pending") => {
        if (filter === "pending") {
            if (!canSeePendingTab) return;
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
        const canActivateContract = lease.status === "DRAFT";
        const canCancelContract = lease.status === "DRAFT" || lease.status === "ACTIVE";
        const isUpdatingContractStatus = activateContractMutation.isPending || cancelContractMutation.isPending;
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                        aria-label={`Contract actions for ${contextLabel}`}
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
                            Edit Contract
                        </DropdownMenuItem>
                    ) : null}
                    {canWriteLease && canActivateContract ? (
                        <DropdownMenuItem
                            disabled={isUpdatingContractStatus}
                            onClick={(event) => {
                                event.stopPropagation();
                                void activateContract(lease);
                            }}
                        >
                            Activate Contract
                        </DropdownMenuItem>
                    ) : null}
                    {canWriteLease && canCancelContract ? (
                        <DropdownMenuItem
                            disabled={isUpdatingContractStatus}
                            onClick={(event) => {
                                event.stopPropagation();
                                void cancelContract(lease);
                            }}
                        >
                            Cancel Contract
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Browse active and ended contracts across your organization.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {canWriteLease ? (
                        <>
                            <Button
                                onClick={() => setAddContractOpen(true)}
                                disabled={!canCreateContract}
                                title={!canCreateContract ? "Select a building to add a contract." : undefined}
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add Contract
                            </Button>
                            {!canCreateContract ? (
                                <p className="self-center text-xs text-zinc-500">
                                    Select a building to enable contract creation.
                                </p>
                            ) : null}
                        </>
                    ) : null}
                    {isTenant ? (
                        <>
                            {latestResidentContract?.id ? (
                                <Button asChild variant="outline">
                                    <Link href={`${leaseBasePath}/${latestResidentContract.id}`}>
                                        View Latest Contract
                                    </Link>
                                </Button>
                            ) : (
                                <Button variant="outline" disabled>
                                    View Latest Contract
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => openMoveRequestDialog("move-in")}
                                disabled={!canTenantRequestMoveIn}
                                title={!canTenantRequestMoveIn ? "Move-in request is available only for active contracts with no occupancy." : undefined}
                            >
                                Move-In Request
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => openMoveRequestDialog("move-out")}
                                disabled={!canTenantRequestMoveOut}
                                title={!canTenantRequestMoveOut ? "Move-out request is available only for active contracts with active occupancy." : undefined}
                            >
                                Move-Out Request
                            </Button>
                            <p className="self-center text-xs text-zinc-500">
                                {latestContractForResidentQuery.isLoading
                                    ? "Checking latest contract..."
                                    : latestResidentContract
                                        ? `Latest contract: ${latestResidentContract.status}`
                                        : "No latest contract found."}
                            </p>
                        </>
                    ) : null}
                </div>
            </div>

            <div className="sticky top-2 z-20 rounded-2xl border border-zinc-200 bg-white/95 p-4 backdrop-blur">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Active Contracts</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.active}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Draft Contracts</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.draft}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Ended Contracts</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.ended}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="text-xs text-zinc-500">Cancelled Contracts</div>
                        <div className="text-lg font-semibold text-zinc-900">{leaseCounts.cancelled}</div>
                    </div>
                </div>
            </div>

            <Tabs value={resolvedActiveTab} onValueChange={(value) => setActiveTab(value as LeasePageTab)} className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <TabsList className={`grid w-full max-w-lg ${canSeePendingTab ? "grid-cols-2" : "grid-cols-1"}`}>
                        <TabsTrigger value="leases" aria-label="Show contracts">
                            Contracts List
                        </TabsTrigger>
                        {canSeePendingTab ? (
                            <TabsTrigger value="pending" aria-label="Show move request queues">
                                Move Requests
                            </TabsTrigger>
                        ) : null}
                    </TabsList>
                </div>

                <TabsContent value="leases">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant={resolvedActiveTab === "leases" && status === "ALL" && !dateFromLocal && !dateToLocal ? "default" : "outline"}
                        onClick={() => applyQuickFilter("all")}
                    >
                        All Contracts
                    </Button>
                    <Button
                        size="sm"
                        variant={resolvedActiveTab === "leases" && status === "ACTIVE" && !dateFromLocal && !dateToLocal ? "default" : "outline"}
                        onClick={() => applyQuickFilter("active")}
                    >
                        Active
                    </Button>
                    <Button
                        size="sm"
                        variant={resolvedActiveTab === "leases" && status === "ACTIVE" && Boolean(dateToLocal) ? "default" : "outline"}
                        onClick={() => applyQuickFilter("expiring_30d")}
                    >
                        Active + Date To 30d
                    </Button>
                    <Button
                        size="sm"
                        variant={resolvedActiveTab === "leases" && status === "ENDED" && Boolean(dateFromLocal) ? "default" : "outline"}
                        onClick={() => applyQuickFilter("ended_30d")}
                    >
                        Ended + Date From 30d
                    </Button>
                    {canSeePendingTab ? (
                        <Button
                            size="sm"
                            variant={resolvedActiveTab === "pending" ? "default" : "outline"}
                            onClick={() => applyQuickFilter("pending")}
                        >
                            Move Requests
                        </Button>
                    ) : null}
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
                                placeholder="Search contract/resident/unit..."
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
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="ENDED">Ended</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                            <p className="text-xs text-zinc-500">Loading contracts...</p>
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                        </div>
                    ) : leasesQuery.isError && leaseListState.items.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                            <p>
                                {errorStatus === 404
                                    ? "The org-wide contracts endpoint is not available yet (`GET /api/org/contracts`)."
                                    : errorStatus === 401
                                        ? "Your session expired. Please sign in again."
                                        : errorStatus === 403
                                            ? "You do not have access to view org contracts."
                                            : errorStatus === 400
                                                ? "Invalid filters. Check date range and filter values."
                                                : "Failed to load contracts."}
                            </p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => leasesQuery.refetch()}>
                                Try again
                            </Button>
                        </div>
                    ) : leaseListState.items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            <p>
                                {hasLeaseFilters
                                    ? "No contracts match the current filters."
                                    : "No contracts found yet. Add a contract to get started."}
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
                                                        className={getStatusBadgeClassName(lease.status)}
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
                                                            {group.totalLeases} contract{group.totalLeases === 1 ? "" : "s"}
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
                                                                        className={getStatusBadgeClassName(lease.status)}
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

                {canSeePendingTab ? (
                <TabsContent value="pending">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">Move Requests Queue</h2>
                                <p className="text-sm text-zinc-500">
                                    Review move-in/move-out requests, then approve, reject, and execute.
                                </p>
                            </div>
                            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                                    <SelectTrigger className="w-full sm:w-[260px]">
                                        <SelectValue placeholder="Select building" />
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
                                <Select
                                    value={pendingRequestStatus}
                                    onValueChange={(value) => setPendingRequestStatus(value as ContractMoveRequestStatusFilter)}
                                >
                                    <SelectTrigger className="w-full sm:w-[260px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="APPROVED">Approved</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="ALL">All statuses</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="mb-4 flex gap-2">
                            <Button
                                size="sm"
                                variant={pendingQueueType === "move-in" ? "default" : "outline"}
                                onClick={() => setPendingQueueType("move-in")}
                            >
                                Move-In Requests
                            </Button>
                            <Button
                                size="sm"
                                variant={pendingQueueType === "move-out" ? "default" : "outline"}
                                onClick={() => setPendingQueueType("move-out")}
                            >
                                Move-Out Requests
                            </Button>
                        </div>

                        {!canManageMoveRequests ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center text-sm text-zinc-500">
                                Select a single building to manage move requests.
                            </div>
                        ) : activeMoveRequestsQuery.isLoading ? (
                            <div className="space-y-3">
                                <p className="text-xs text-zinc-500">Loading move requests...</p>
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                            </div>
                        ) : activeMoveRequestsQuery.isError ? (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                                <p>Failed to load move requests.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => activeMoveRequestsQuery.refetch()}
                                >
                                    Try again
                                </Button>
                            </div>
                        ) : activeMoveRequests.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center text-sm text-zinc-500">
                                No {pendingQueueType === "move-in" ? "move-in" : "move-out"} requests found for the selected filters.
                            </div>
                        ) : (
                            <div className="rounded-lg border border-zinc-200 bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Requested At</TableHead>
                                            <TableHead>Resident</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Notes</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeMoveRequests.map((request) => {
                                            const requestContractId = request.contractId || request.leaseId;
                                            const linkedLease = requestContractId ? leaseById.get(requestContractId) : undefined;
                                            const residentDisplayLabel =
                                                request.resident?.name ||
                                                request.resident?.email ||
                                                linkedLease?.resident?.name ||
                                                linkedLease?.resident?.email ||
                                                request.residentUserId ||
                                                "-";
                                            const unitLabel =
                                                request.unit?.label ||
                                                linkedLease?.unit?.label ||
                                                null;
                                            const unitDisplayLabel = unitLabel
                                                ? `Unit ${unitLabel}`
                                                : request.unitId || linkedLease?.unitId || "-";
                                            const canApproveReject = request.status === "PENDING";
                                            const canExecute = request.status === "APPROVED" && Boolean(requestContractId);
                                            const isActionPending =
                                                approveMoveInRequestMutation.isPending
                                                || rejectMoveInRequestMutation.isPending
                                                || approveMoveOutRequestMutation.isPending
                                                || rejectMoveOutRequestMutation.isPending
                                                || executeMoveInMutation.isPending
                                                || executeMoveOutMutation.isPending;
                                            return (
                                                <TableRow key={request.id}>
                                                    <TableCell className="text-sm text-zinc-700">
                                                        {formatDateTime(request.requestedMoveAt)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-700">
                                                        {residentDisplayLabel}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-700">
                                                        {unitDisplayLabel}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={getMoveRequestStatusBadgeClassName(request.status)}
                                                        >
                                                            {request.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate text-sm text-zinc-700">
                                                        {request.notes || request.rejectionReason || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {canApproveReject ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={isActionPending}
                                                                        onClick={() => void approveRequest(request, pendingQueueType)}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={isActionPending}
                                                                        onClick={() => {
                                                                            setRejectRequestContext({
                                                                                requestId: request.id,
                                                                                requestType: pendingQueueType,
                                                                            });
                                                                            setRejectionReason("");
                                                                        }}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            ) : null}
                                                            {canExecute ? (
                                                                <Button
                                                                    size="sm"
                                                                    disabled={isActionPending}
                                                                    onClick={() => void executeRequest(request, pendingQueueType)}
                                                                >
                                                                    {pendingQueueType === "move-in" ? "Execute Move-In" : "Execute Move-Out"}
                                                                </Button>
                                                            ) : null}
                                                            {requestContractId ? (
                                                                <Button size="sm" variant="ghost" asChild>
                                                                    <Link href={`${leaseBasePath}/${requestContractId}`}>
                                                                        Contract
                                                                    </Link>
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </TabsContent>
                ) : null}
            </Tabs>

            <Dialog open={Boolean(moveRequestType)} onOpenChange={closeMoveRequestDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {moveRequestType === "move-in" ? "Submit Move-In Request" : "Submit Move-Out Request"}
                        </DialogTitle>
                        <DialogDescription>
                            {moveRequestType === "move-in"
                                ? "Request your preferred move-in date and time for the latest active contract."
                                : "Request your preferred move-out date and time for the latest active contract."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Requested Move At</label>
                            <Input
                                type="datetime-local"
                                value={requestedMoveAtLocal}
                                onChange={(event) => setRequestedMoveAtLocal(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Notes (optional)</label>
                            <Textarea
                                rows={4}
                                value={moveRequestNotes}
                                onChange={(event) => setMoveRequestNotes(event.target.value)}
                                placeholder="Any scheduling notes for management..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => closeMoveRequestDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void submitMoveRequest()}
                            disabled={createMoveInRequestMutation.isPending || createMoveOutRequestMutation.isPending}
                        >
                            {(createMoveInRequestMutation.isPending || createMoveOutRequestMutation.isPending)
                                ? "Submitting..."
                                : "Submit Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(rejectRequestContext)} onOpenChange={closeRejectDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Reject {rejectRequestContext?.requestType === "move-in" ? "Move-In" : "Move-Out"} Request
                        </DialogTitle>
                        <DialogDescription>
                            Provide a rejection reason (optional).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-900">Rejection reason</label>
                        <Textarea
                            rows={4}
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder="Requested slot is not available."
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => closeRejectDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void rejectRequest()}
                            disabled={rejectMoveInRequestMutation.isPending || rejectMoveOutRequestMutation.isPending}
                        >
                            {(rejectMoveInRequestMutation.isPending || rejectMoveOutRequestMutation.isPending)
                                ? "Rejecting..."
                                : "Reject Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedBuildingForActions ? (
                <AddContractDialog
                    open={addContractOpen}
                    onOpenChange={setAddContractOpen}
                    buildingId={selectedBuildingForActions}
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

        </div>
    );
}
