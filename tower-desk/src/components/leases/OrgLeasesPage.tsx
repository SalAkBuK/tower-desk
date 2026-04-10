"use client";

import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasAnyPermission, hasPermission, hasPermissionPrefix } from "@/lib/permissions";
import { getPortalModuleByKey } from "@/lib/portalRegistry";
import { isOrganizationAdminRole } from "@/lib/roles";
import {
    useActivateContract,
    useApproveMoveInRequest,
    useApproveMoveOutRequest,
    useCancelContract,
    useCreateMoveInRequest,
    useCreateMoveOutRequest,
    useExecuteMoveIn,
    useExecuteMoveOut,
    useLatestContractForResident,
    useAccessibleBuildings,
    useMoveInRequests,
    useMoveOutRequests,
    useOrgLeases,
    useRejectMoveInRequest,
    useRejectMoveOutRequest,
} from "@/lib/queries";
import { getPathWithoutSearchParams } from "@/lib/searchParams";
import { AddContractDialog, type AddContractPrefill } from "@/components/leases/AddContractDialog";
import { EditLeaseDialog } from "@/components/leases/EditLeaseDialog";
import { OrgLeaseActionsMenu } from "./org-leases/OrgLeaseActionsMenu";
import type {
    ContractMoveRequest,
    Lease,
    OrgLeaseStatusFilter,
    TimelineOrder,
} from "@/lib/types";
import {
    ALL_BUILDINGS,
    type LegacyLeasePageTab,
    type LeasePageTab,
    type LeaseResidentGroup,
    type LeaseViewMode,
    type MoveOperationsSection,
    type MoveRequestType,
    type MoveRequestTypeFilter,
    type PendingQueueType,
    type RejectRequestContext,
    type ResolvedRequestStatusFilter,
    isLegacyLeasePageTab,
    isLeasePageTab,
    isLeaseViewMode,
    isMoveOperationsSection,
    isMoveRequestTypeFilter,
    isOrgLeaseStatusFilter,
    isPendingQueueType,
    isResolvedRequestStatusFilter,
    isTimelineOrder,
} from "./org-leases/types";
import {
    createCursorListReducer,
    formatDate,
    formatDateTime,
    formatMoney,
    getLeaseActionAvailability,
    getLeaseBadgeLabel,
    getLeaseBadgeStatus,
    getMoveRequestRowMeta,
    getMoveRequestStatusBadgeClassName,
    getStatusBadgeClassName,
    groupLeasesByResident,
    initialCursorListState,
    mergeById,
    toDateTimeLocalFromDate,
    toDateTimeLocalInput,
    toErrorStatus,
    toIsoOrUndefined,
} from "./org-leases/utils";

interface OrgLeasesPageProps {
    title?: string;
}

type MoveOperationEntry = {
    request: ContractMoveRequest;
    requestType: PendingQueueType;
};

type SearchParamReader = {
    get: (key: string) => string | null;
};

const getLegacyLeasePageTab = (value: string | null): LegacyLeasePageTab | null =>
    isLegacyLeasePageTab(value) ? value : null;

const resolveOperationsSectionFromSearchParams = (searchParams: SearchParamReader) => {
    const explicitSection = searchParams.get("section");
    if (isMoveOperationsSection(explicitSection)) return explicitSection;

    const requestStatus = searchParams.get("requestStatus");
    if (requestStatus === "APPROVED") return "ready";
    if (isResolvedRequestStatusFilter(requestStatus) && requestStatus !== "ALL") return "history";

    const legacyTab = getLegacyLeasePageTab(searchParams.get("tab"));
    if (legacyTab === "execute-move-in" || legacyTab === "execute-move-out") return "ready";
    if (legacyTab === "pending") {
        if (requestStatus === "APPROVED") return "ready";
        if (isResolvedRequestStatusFilter(requestStatus) && requestStatus !== "ALL") return "history";
    }

    return "review" as const;
};

const resolveMoveTypeFilterFromSearchParams = (searchParams: SearchParamReader): MoveRequestTypeFilter => {
    const explicitMoveType = searchParams.get("moveType");
    if (isMoveRequestTypeFilter(explicitMoveType)) return explicitMoveType;

    const legacyQueue = searchParams.get("queue");
    if (isPendingQueueType(legacyQueue)) return legacyQueue;

    const legacyTab = getLegacyLeasePageTab(searchParams.get("tab"));
    if (legacyTab === "execute-move-in") return "move-in";
    if (legacyTab === "execute-move-out") return "move-out";

    return "all";
};

const resolveResolvedStatusFromSearchParams = (searchParams: SearchParamReader): ResolvedRequestStatusFilter => {
    const requestStatus = searchParams.get("requestStatus");
    return isResolvedRequestStatusFilter(requestStatus) ? requestStatus : "ALL";
};

const mapMoveRequests = (requests: ContractMoveRequest[], requestType: PendingQueueType): MoveOperationEntry[] =>
    requests.map((request) => ({ request, requestType }));

const sortMoveOperationEntries = (entries: MoveOperationEntry[]) =>
    [...entries].sort(
        (left, right) =>
            new Date(right.request.requestedMoveAt).getTime() - new Date(left.request.requestedMoveAt).getTime()
    );

function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

export function OrgLeasesPage({ title = "Contracts" }: OrgLeasesPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, baseRole } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const contractsModuleRule = getPortalModuleByKey("contracts")?.rule;
    const canAccessContractsModule = Boolean(contractsModuleRule && hasAnyPermission(permissionSet, contractsModuleRule));
    const canReadLease =
        hasPermission(permissionSet, "contracts.read") ||
        hasPermissionPrefix(permissionSet, "contracts.read") ||
        hasPermissionPrefix(permissionSet, "contracts") ||
        hasPermission(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases.read") ||
        hasPermissionPrefix(permissionSet, "leases");
    const canCreateLease =
        hasPermission(permissionSet, "contracts.create") ||
        hasPermissionPrefix(permissionSet, "contracts.create") ||
        hasPermission(permissionSet, "leases.create") ||
        hasPermissionPrefix(permissionSet, "leases.create");
    const canWriteLease =
        hasPermission(permissionSet, "contracts.write") ||
        hasPermissionPrefix(permissionSet, "contracts.write") ||
        hasPermission(permissionSet, "leases.write") ||
        hasPermissionPrefix(permissionSet, "leases.write");
    const canReviewMoveRequests =
        hasPermission(permissionSet, "contracts.move_requests.review") ||
        hasPermissionPrefix(permissionSet, "contracts.move_requests.review") ||
        hasPermission(permissionSet, "leases.move_requests.review") ||
        hasPermissionPrefix(permissionSet, "leases.move_requests.review") ||
        hasPermission(permissionSet, "contracts.move_requests.write") ||
        hasPermissionPrefix(permissionSet, "contracts.move_requests.write") ||
        hasPermission(permissionSet, "leases.move_requests.write") ||
        hasPermissionPrefix(permissionSet, "leases.move_requests.write") ||
        canWriteLease;
    const canExecuteMoveRequests =
        hasPermission(permissionSet, "contracts.move_requests.execute") ||
        hasPermissionPrefix(permissionSet, "contracts.move_requests.execute") ||
        hasPermission(permissionSet, "leases.move_requests.execute") ||
        hasPermissionPrefix(permissionSet, "leases.move_requests.execute") ||
        canWriteLease;
    const canQueryOrgWideLeases = isOrganizationAdminRole(baseRole);
    const isTenant = baseRole === "tenant";
    const isBuildingAdmin = baseRole === "building_admin";
    const leaseBasePath = "/portal/leases";

    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: canAccessContractsModule });
    const buildings = accessibleBuildingsQuery.data;

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
        if (isLeasePageTab(param)) return param;
        if (isLegacyLeasePageTab(param)) return "operations";
        return "leases";
    });
    const [operationsSection, setOperationsSection] = useState<MoveOperationsSection>(() =>
        resolveOperationsSectionFromSearchParams(searchParams)
    );
    const [selectedBuildingId, setSelectedBuildingId] = useState(
        () => searchParams.get("buildingId") || ""
    );
    const [search, setSearch] = useState(() => searchParams.get("q") || "");
    const [operationsSearch, setOperationsSearch] = useState(() => searchParams.get("requestQ") || "");
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
    const addContractActionFromQuery = searchParams.get("action") === "add-contract";
    const [addContractOpen, setAddContractOpen] = useState(addContractActionFromQuery);
    const [addContractPrefill, setAddContractPrefill] = useState<AddContractPrefill | null>(
        addContractActionFromQuery
            ? {
                residentUserId: searchParams.get("residentUserId") ?? undefined,
                tenantNameSnapshot: searchParams.get("residentName") ?? undefined,
                tenantEmailSnapshot: searchParams.get("residentEmail") ?? undefined,
                tenantPhoneSnapshot: searchParams.get("residentPhone") ?? undefined,
            }
            : null
    );
    const [moveRequestType, setMoveRequestType] = useState<MoveRequestType | null>(null);
    const [requestedMoveAtLocal, setRequestedMoveAtLocal] = useState("");
    const [moveRequestNotes, setMoveRequestNotes] = useState("");
    const deepLinkedMoveRequestId = searchParams.get("requestId")?.trim() ?? "";
    const [moveTypeFilter, setMoveTypeFilter] = useState<MoveRequestTypeFilter>(() =>
        resolveMoveTypeFilterFromSearchParams(searchParams)
    );
    const [resolvedStatusFilter, setResolvedStatusFilter] = useState<ResolvedRequestStatusFilter>(() =>
        resolveResolvedStatusFromSearchParams(searchParams)
    );
    const [rejectRequestContext, setRejectRequestContext] = useState<RejectRequestContext | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const clearAddContractSearchParams = () => {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("action");
        nextParams.delete("residentUserId");
        nextParams.delete("residentName");
        nextParams.delete("residentEmail");
        nextParams.delete("residentPhone");
        const nextQuery = nextParams.toString();
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    };

    const resolvedSelectedBuildingId = useMemo(() => {
        if (canQueryOrgWideLeases && selectedBuildingId === ALL_BUILDINGS) return ALL_BUILDINGS;
        if (!selectedBuildingId) return buildingOptions[0]?.id || (canQueryOrgWideLeases ? ALL_BUILDINGS : "");
        return buildingOptions.some((building) => building.id === selectedBuildingId)
            ? selectedBuildingId
            : (buildingOptions[0]?.id || (canQueryOrgWideLeases ? ALL_BUILDINGS : ""));
    }, [buildingOptions, canQueryOrgWideLeases, selectedBuildingId]);
    const activeBuildingLabel = useMemo(() => {
        if (resolvedSelectedBuildingId === ALL_BUILDINGS) return "All Buildings";
        return buildingOptions.find((building) => building.id === resolvedSelectedBuildingId)?.name ?? "Select building";
    }, [buildingOptions, resolvedSelectedBuildingId]);
    const effectiveBuildingId =
        resolvedSelectedBuildingId && resolvedSelectedBuildingId !== ALL_BUILDINGS ? resolvedSelectedBuildingId : undefined;
    const trimmedSearch = search.trim();
    const selectedBuildingForActions = effectiveBuildingId ?? "";
    const hasSelectedBuildingScope = Boolean(
        selectedBuildingForActions
        && buildingOptions.some((building) => building.id === selectedBuildingForActions)
    );
    const canCreateContractEntry = canCreateLease || canWriteLease || isBuildingAdmin;
    const canCreateContract = hasSelectedBuildingScope && (canCreateLease || canWriteLease || isBuildingAdmin);
    const canSeePendingTab = !isTenant && (canReadLease || canReviewMoveRequests || isBuildingAdmin);
    const resolvedActiveTab: LeasePageTab = canSeePendingTab ? activeTab : "leases";
    const canManageMoveRequests = canSeePendingTab && hasSelectedBuildingScope;
    const canReviewMoveRequestActions = canReviewMoveRequests && hasSelectedBuildingScope;
    const canExecuteMoveRequestActions = canExecuteMoveRequests && hasSelectedBuildingScope;
    const hasMoveRequestBuildingAccess = (request: ContractMoveRequest) => {
        if (!canManageMoveRequests || !effectiveBuildingId) return false;
        return String(request.buildingId ?? "") === String(effectiveBuildingId);
    };
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
    const reviewMoveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        "PENDING",
        { enabled: canManageMoveRequests }
    );
    const reviewMoveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        "PENDING",
        { enabled: canManageMoveRequests }
    );
    const readyMoveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        "APPROVED",
        { enabled: canManageMoveRequests }
    );
    const readyMoveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        "APPROVED",
        { enabled: canManageMoveRequests }
    );
    const rejectedMoveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        "REJECTED",
        { enabled: canManageMoveRequests }
    );
    const rejectedMoveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        "REJECTED",
        { enabled: canManageMoveRequests }
    );
    const cancelledMoveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        "CANCELLED",
        { enabled: canManageMoveRequests }
    );
    const cancelledMoveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        "CANCELLED",
        { enabled: canManageMoveRequests }
    );
    const completedMoveInRequestsQuery = useMoveInRequests(
        effectiveBuildingId,
        "COMPLETED",
        { enabled: canManageMoveRequests }
    );
    const completedMoveOutRequestsQuery = useMoveOutRequests(
        effectiveBuildingId,
        "COMPLETED",
        { enabled: canManageMoveRequests }
    );
    const leaseById = useMemo(() => {
        const map = new Map<string, Lease>();
        leaseListState.items.forEach((lease) => {
            map.set(lease.id, lease);
        });
        return map;
    }, [leaseListState.items]);
    const normalizedOperationsSearch = operationsSearch.trim().toLowerCase();
    const matchesMoveRequestFilters = (entry: MoveOperationEntry) => {
        if (moveTypeFilter !== "all" && entry.requestType !== moveTypeFilter) return false;
        if (!normalizedOperationsSearch) return true;
        const linkedLease = leaseById.get(entry.request.contractId || entry.request.leaseId || "");
        const haystack = [
            entry.request.resident?.name,
            entry.request.resident?.email,
            linkedLease?.resident?.name,
            linkedLease?.resident?.email,
            entry.request.residentUserId,
            entry.request.unit?.label,
            linkedLease?.unit?.label,
            entry.request.unitId,
            entry.request.notes,
            buildingNameById[entry.request.buildingId],
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(normalizedOperationsSearch);
    };
    const reviewEntries = useMemo(
        () =>
            sortMoveOperationEntries([
                ...mapMoveRequests(reviewMoveInRequestsQuery.data ?? [], "move-in"),
                ...mapMoveRequests(reviewMoveOutRequestsQuery.data ?? [], "move-out"),
            ]).filter(matchesMoveRequestFilters),
        [
            buildingNameById,
            leaseById,
            matchesMoveRequestFilters,
            reviewMoveInRequestsQuery.data,
            reviewMoveOutRequestsQuery.data,
        ]
    );
    const readyEntries = useMemo(
        () =>
            sortMoveOperationEntries([
                ...mapMoveRequests(readyMoveInRequestsQuery.data ?? [], "move-in"),
                ...mapMoveRequests(readyMoveOutRequestsQuery.data ?? [], "move-out"),
            ]).filter(matchesMoveRequestFilters),
        [
            buildingNameById,
            leaseById,
            matchesMoveRequestFilters,
            readyMoveInRequestsQuery.data,
            readyMoveOutRequestsQuery.data,
        ]
    );
    const resolvedEntries = useMemo(() => {
        const allResolved = sortMoveOperationEntries([
            ...mapMoveRequests(rejectedMoveInRequestsQuery.data ?? [], "move-in"),
            ...mapMoveRequests(rejectedMoveOutRequestsQuery.data ?? [], "move-out"),
            ...mapMoveRequests(cancelledMoveInRequestsQuery.data ?? [], "move-in"),
            ...mapMoveRequests(cancelledMoveOutRequestsQuery.data ?? [], "move-out"),
            ...mapMoveRequests(completedMoveInRequestsQuery.data ?? [], "move-in"),
            ...mapMoveRequests(completedMoveOutRequestsQuery.data ?? [], "move-out"),
        ]).filter(matchesMoveRequestFilters);
        if (resolvedStatusFilter === "ALL") return allResolved;
        return allResolved.filter((entry) => entry.request.status === resolvedStatusFilter);
    }, [
        buildingNameById,
        cancelledMoveInRequestsQuery.data,
        cancelledMoveOutRequestsQuery.data,
        completedMoveInRequestsQuery.data,
        completedMoveOutRequestsQuery.data,
        leaseById,
        matchesMoveRequestFilters,
        rejectedMoveInRequestsQuery.data,
        rejectedMoveOutRequestsQuery.data,
        resolvedStatusFilter,
    ]);
    const operationsCount = reviewEntries.length + readyEntries.length;
    const reviewSectionLoading = reviewMoveInRequestsQuery.isLoading || reviewMoveOutRequestsQuery.isLoading;
    const reviewSectionError = reviewMoveInRequestsQuery.isError || reviewMoveOutRequestsQuery.isError;
    const readySectionLoading = readyMoveInRequestsQuery.isLoading || readyMoveOutRequestsQuery.isLoading;
    const readySectionError = readyMoveInRequestsQuery.isError || readyMoveOutRequestsQuery.isError;
    const historySectionLoading =
        rejectedMoveInRequestsQuery.isLoading
        || rejectedMoveOutRequestsQuery.isLoading
        || cancelledMoveInRequestsQuery.isLoading
        || cancelledMoveOutRequestsQuery.isLoading
        || completedMoveInRequestsQuery.isLoading
        || completedMoveOutRequestsQuery.isLoading;
    const historySectionError =
        rejectedMoveInRequestsQuery.isError
        || rejectedMoveOutRequestsQuery.isError
        || cancelledMoveInRequestsQuery.isError
        || cancelledMoveOutRequestsQuery.isError
        || completedMoveInRequestsQuery.isError
        || completedMoveOutRequestsQuery.isError;
    const deepLinkedHistoryRequest = Boolean(
        deepLinkedMoveRequestId && resolvedEntries.some((entry) => entry.request.id === deepLinkedMoveRequestId)
    );
    const isHistoryExpanded = operationsSection === "history" || deepLinkedHistoryRequest;
    const hasLeaseFilters =
        status !== "ALL" ||
        resolvedSelectedBuildingId !== ALL_BUILDINGS ||
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
        else nextParams.set("tab", "operations");
        if (resolvedSelectedBuildingId === ALL_BUILDINGS) nextParams.delete("buildingId");
        else nextParams.set("buildingId", resolvedSelectedBuildingId);
        if (trimmedSearch) nextParams.set("q", trimmedSearch);
        else nextParams.delete("q");
        if (dateFromLocal) nextParams.set("date_from", dateFromLocal);
        else nextParams.delete("date_from");
        if (dateToLocal) nextParams.set("date_to", dateToLocal);
        else nextParams.delete("date_to");
        if (!canSeePendingTab) {
            nextParams.delete("section");
            nextParams.delete("moveType");
            nextParams.delete("requestStatus");
            nextParams.delete("requestQ");
        } else {
            nextParams.delete("queue");
            if (resolvedActiveTab !== "operations" || operationsSection === "review") nextParams.delete("section");
            else nextParams.set("section", operationsSection);
            if (resolvedActiveTab !== "operations" || moveTypeFilter === "all") nextParams.delete("moveType");
            else nextParams.set("moveType", moveTypeFilter);
            if (resolvedActiveTab === "operations" && operationsSection === "history" && resolvedStatusFilter !== "ALL") {
                nextParams.set("requestStatus", resolvedStatusFilter);
            } else {
                nextParams.delete("requestStatus");
            }
            if (resolvedActiveTab === "operations" && operationsSearch.trim()) {
                nextParams.set("requestQ", operationsSearch.trim());
            } else {
                nextParams.delete("requestQ");
            }
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
        operationsSection,
        moveTypeFilter,
        resolvedStatusFilter,
        operationsSearch,
        resolvedSelectedBuildingId,
        trimmedSearch,
        dateFromLocal,
        dateToLocal,
        pathname,
        router,
        searchParams,
    ]);

    useEffect(() => {
        if (!addContractActionFromQuery) return;
        setAddContractPrefill({
            residentUserId: searchParams.get("residentUserId") ?? undefined,
            tenantNameSnapshot: searchParams.get("residentName") ?? undefined,
            tenantEmailSnapshot: searchParams.get("residentEmail") ?? undefined,
            tenantPhoneSnapshot: searchParams.get("residentPhone") ?? undefined,
        });
        setAddContractOpen(true);
        if (activeTab !== "leases") {
            setActiveTab("leases");
        }
    }, [activeTab, addContractActionFromQuery, searchParams]);

    useEffect(() => {
        if (!deepLinkedMoveRequestId || resolvedActiveTab !== "operations") return;
        const matchedSection = reviewEntries.some((entry) => entry.request.id === deepLinkedMoveRequestId)
            ? "review"
            : readyEntries.some((entry) => entry.request.id === deepLinkedMoveRequestId)
                ? "ready"
                : resolvedEntries.some((entry) => entry.request.id === deepLinkedMoveRequestId)
                    ? "history"
                    : null;
        if (matchedSection && operationsSection !== matchedSection) {
            setOperationsSection(matchedSection);
        }
        const target = document.getElementById(`move-request-${deepLinkedMoveRequestId}`);
        if (!target) return;
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        router.replace(getPathWithoutSearchParams(pathname, searchParams, ["requestId"]), { scroll: false });
    }, [
        deepLinkedMoveRequestId,
        operationsSection,
        pathname,
        readyEntries,
        resolvedActiveTab,
        resolvedEntries,
        reviewEntries,
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
        { enabled: canReadLease && (canQueryOrgWideLeases || Boolean(effectiveBuildingId)) }
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
    const residentGroups = useMemo<LeaseResidentGroup[]>(
        () => groupLeasesByResident(leaseListState.items),
        [leaseListState.items]
    );

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
        if (!canReviewMoveRequestActions) {
            toast.error("You do not have permission to approve or reject move requests for this building.");
            return;
        }
        if (!hasMoveRequestBuildingAccess(request)) {
            toast.error("You can only manage move requests for the selected building.");
            return;
        }
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
        if (!canReviewMoveRequestActions) {
            toast.error("You do not have permission to approve or reject move requests for this building.");
            return;
        }
        if (!rejectRequestContext.buildingId || String(rejectRequestContext.buildingId) !== String(effectiveBuildingId ?? "")) {
            toast.error("You can only manage move requests for the selected building.");
            return;
        }
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
        if (!canExecuteMoveRequestActions) {
            toast.error("You do not have permission to execute move requests for this building.");
            return;
        }
        if (!hasMoveRequestBuildingAccess(request)) {
            toast.error("You can only execute move requests for the selected building.");
            return;
        }
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

    const applyQuickFilter = (
        filter: "all" | "active" | "expiring_30d" | "ended_30d"
    ) => {
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
        const { canActivateContract, canCancelContract, canEditContract } = getLeaseActionAvailability(lease, canWriteLease);
        const isUpdatingContractStatus = activateContractMutation.isPending || cancelContractMutation.isPending;
        return (
            <OrgLeaseActionsMenu
                canActivateContract={canActivateContract}
                canCancelContract={canCancelContract}
                canEditContract={canEditContract}
                contextLabel={contextLabel}
                isUpdatingContractStatus={isUpdatingContractStatus}
                lease={lease}
                leaseBasePath={leaseBasePath}
                onEdit={setEditLeaseContext}
                onActivate={(currentLease) => void activateContract(currentLease)}
                onCancel={(currentLease) => void cancelContract(currentLease)}
            />
        );
    };

    const focusOperationsSection = (section: MoveOperationsSection) => {
        setActiveTab("operations");
        setOperationsSection(section);
        if (typeof document === "undefined") return;
        window.requestAnimationFrame(() => {
            document.getElementById(`move-operations-${section}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    };

    const renderMoveRequestTable = (
        entries: MoveOperationEntry[],
        options: {
            emptyText: string;
            isLoading: boolean;
            isError: boolean;
            onRetry: () => void;
            enableApproveReject?: boolean;
            enableExecute?: boolean;
        }
    ) => {
        if (!canManageMoveRequests) {
            return (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center text-sm text-zinc-500">
                    Select a single building to manage move requests.
                </div>
            );
        }
        if (options.isLoading) {
            return (
                <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Loading move requests...</p>
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                </div>
            );
        }
        if (options.isError) {
            return (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                    <p>Failed to load move requests.</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={options.onRetry}
                    >
                        Try again
                    </Button>
                </div>
            );
        }
        if (entries.length === 0) {
            return (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center text-sm text-zinc-500">
                    {options.emptyText}
                </div>
            );
        }

        const isActionPending =
            approveMoveInRequestMutation.isPending
            || rejectMoveInRequestMutation.isPending
            || approveMoveOutRequestMutation.isPending
            || rejectMoveOutRequestMutation.isPending
            || executeMoveInMutation.isPending
            || executeMoveOutMutation.isPending;

        return (
            <div className="rounded-lg border border-zinc-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Type</TableHead>
                            <TableHead>Requested At</TableHead>
                            <TableHead>Resident</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => {
                            const { request, requestType } = entry;
                            const { canApproveReject, canExecute, requestContractId } = getMoveRequestRowMeta(request);
                            const isDeepLinkedRequest = Boolean(
                                deepLinkedMoveRequestId
                                && String(request.id) === String(deepLinkedMoveRequestId)
                            );
                            const linkedLease = requestContractId ? leaseById.get(requestContractId) : undefined;
                            const hasScopedBuildingAccess = hasMoveRequestBuildingAccess(request);
                            const canApproveRejectAction =
                                Boolean(options.enableApproveReject)
                                && canApproveReject
                                && canReviewMoveRequestActions
                                && hasScopedBuildingAccess;
                            const canExecuteAction =
                                Boolean(options.enableExecute)
                                && canExecute
                                && canExecuteMoveRequestActions
                                && hasScopedBuildingAccess;
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

                            return (
                                <TableRow
                                    key={`${requestType}-${request.id}`}
                                    id={`move-request-${request.id}`}
                                    className={isDeepLinkedRequest ? "bg-amber-50/80 ring-1 ring-inset ring-amber-200" : undefined}
                                >
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={requestType === "move-in"
                                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                                : "border-violet-200 bg-violet-50 text-violet-700"}
                                        >
                                            {requestType === "move-in" ? "Move-In" : "Move-Out"}
                                        </Badge>
                                    </TableCell>
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
                                            {canApproveRejectAction ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isActionPending}
                                                    onClick={() => void approveRequest(request, requestType)}
                                                >
                                                    Approve
                                                </Button>
                                            ) : null}
                                            {canApproveRejectAction ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isActionPending}
                                                    onClick={() => {
                                                        setRejectRequestContext({
                                                            requestId: request.id,
                                                            requestType,
                                                            buildingId: request.buildingId,
                                                        });
                                                        setRejectionReason("");
                                                    }}
                                                >
                                                    Reject
                                                </Button>
                                            ) : null}
                                            {canExecuteAction ? (
                                                <Button
                                                    size="sm"
                                                    disabled={isActionPending}
                                                    onClick={() => void executeRequest(request, requestType)}
                                                >
                                                    {requestType === "move-in" ? "Execute Move-In" : "Execute Move-Out"}
                                                </Button>
                                            ) : null}
                                            {requestContractId ? (
                                                <Button size="sm" variant="ghost" asChild>
                                                    <Link href={`${leaseBasePath}/${requestContractId}`}>
                                                        View Contract
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
        );
    };

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_34%),radial-gradient(circle_at_right_center,_rgba(15,23,42,0.03),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{title}</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                            Browse active and ended contracts across your organization.
                        </p>
                        {!canCreateContract && canCreateContractEntry ? (
                            <p className="mt-3 text-xs text-zinc-500">
                                Select a building to enable contract creation for that building.
                            </p>
                        ) : null}
                        {isTenant ? (
                            <p className="mt-3 text-xs text-zinc-500">
                                {latestContractForResidentQuery.isLoading
                                    ? "Checking latest contract..."
                                    : latestResidentContract
                                        ? `Latest contract: ${latestResidentContract.status}`
                                        : "No latest contract found."}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <div className="rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-[190px]">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Building</div>
                                    <Select value={resolvedSelectedBuildingId} onValueChange={setSelectedBuildingId}>
                                        <SelectTrigger className="h-auto w-full border-none bg-transparent p-0 text-left text-sm font-semibold text-zinc-900 shadow-none focus:ring-0">
                                            <SelectValue placeholder={activeBuildingLabel} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {canQueryOrgWideLeases ? <SelectItem value={ALL_BUILDINGS}>All buildings</SelectItem> : null}
                                            {buildingOptions.map((building) => (
                                                <SelectItem key={building.id} value={building.id}>
                                                    {building.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        {canCreateContractEntry ? (
                            <Button
                                onClick={() => {
                                    clearAddContractSearchParams();
                                    setAddContractPrefill(null);
                                    setAddContractOpen(true);
                                }}
                                disabled={!canCreateContract}
                                title={!canCreateContract ? "Select a building you can create contracts for." : undefined}
                                className="h-11 rounded-xl bg-zinc-900 px-4 text-white hover:bg-zinc-800"
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add Contract
                            </Button>
                        ) : null}
                        {isTenant && latestResidentContract?.id ? (
                            <Button asChild variant="outline" className="h-11 rounded-xl bg-white/90 px-4">
                                <Link href={`${leaseBasePath}/${latestResidentContract.id}`}>
                                    View Latest Contract
                                </Link>
                            </Button>
                        ) : null}
                        {isTenant && !latestResidentContract?.id ? (
                            <Button variant="outline" disabled className="h-11 rounded-xl bg-white/90 px-4">
                                View Latest Contract
                            </Button>
                        ) : null}
                        {isTenant ? (
                            <Button
                                variant="outline"
                                onClick={() => openMoveRequestDialog("move-in")}
                                disabled={!canTenantRequestMoveIn}
                                title={!canTenantRequestMoveIn ? "Move-in request is available only for active contracts with no occupancy." : undefined}
                                className="h-11 rounded-xl bg-white/90 px-4"
                            >
                                Move-In Request
                            </Button>
                        ) : null}
                        {isTenant ? (
                            <Button
                                variant="outline"
                                onClick={() => openMoveRequestDialog("move-out")}
                                disabled={!canTenantRequestMoveOut}
                                title={!canTenantRequestMoveOut ? "Move-out request is available only for active contracts with active occupancy." : undefined}
                                className="h-11 rounded-xl bg-white/90 px-4"
                            >
                                Move-Out Request
                            </Button>
                        ) : null}
                    </div>
                </div>
            </section>

            <Tabs value={resolvedActiveTab} onValueChange={(value) => setActiveTab(value as LeasePageTab)} className="space-y-4">
                <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Active</div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{leaseCounts.active}</div>
                            <p className="mt-2 text-xs text-zinc-500">Current live contracts</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Draft</div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{leaseCounts.draft}</div>
                            <p className="mt-2 text-xs text-zinc-500">Pending contract setup</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Ended</div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{leaseCounts.ended}</div>
                            <p className="mt-2 text-xs text-zinc-500">Completed contract history</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Cancelled</div>
                            <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{leaseCounts.cancelled}</div>
                            <p className="mt-2 text-xs text-zinc-500">Cancelled before activation</p>
                        </div>
                    </div>

                    <div className="mt-5 border-t border-zinc-100 pt-4">
                        <TabsList className={`grid w-full ${canSeePendingTab ? "max-w-xl grid-cols-2" : "max-w-2xl grid-cols-1"}`}>
                            <TabsTrigger value="leases" aria-label="Show contracts">
                                Contracts
                            </TabsTrigger>
                            {canSeePendingTab ? (
                                <TabsTrigger value="operations" aria-label="Show move operations">
                                    <span className="inline-flex items-center gap-2">
                                        <span>Move Operations</span>
                                        <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-semibold">
                                            {operationsCount}
                                        </Badge>
                                    </span>
                                </TabsTrigger>
                            ) : null}
                        </TabsList>
                    </div>
                </section>

                <TabsContent value="leases">
            <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
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
                </div>
                <p className="mb-4 text-xs text-zinc-500">
                    Quick filters use the same server-side date range fields shown below: <code>date_from</code> and <code>date_to</code>.
                </p>

                <div className="grid gap-3 lg:grid-cols-7">
                    <div className="lg:col-span-2">
                        <FilterField label="Search">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search contract/resident/unit..."
                                    className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-9 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                />
                            </div>
                        </FilterField>
                    </div>
                    <FilterField label="Status">
                        <Select value={status} onValueChange={(value) => setStatus(value as OrgLeaseStatusFilter)}>
                            <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
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
                    </FilterField>
                    <FilterField label="Sort">
                        <Select value={order} onValueChange={(value) => setOrder(value as TimelineOrder)}>
                            <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Newest first</SelectItem>
                                <SelectItem value="asc">Oldest first</SelectItem>
                            </SelectContent>
                        </Select>
                    </FilterField>
                    <FilterField label="View">
                        <Select value={viewMode} onValueChange={(value) => setViewMode(value as LeaseViewMode)}>
                            <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="flat">Flat view</SelectItem>
                                <SelectItem value="grouped">Grouped by resident</SelectItem>
                            </SelectContent>
                        </Select>
                    </FilterField>
                    <FilterField label="Building">
                        <Select value={resolvedSelectedBuildingId} onValueChange={setSelectedBuildingId}>
                            <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {canQueryOrgWideLeases ? <SelectItem value={ALL_BUILDINGS}>All buildings</SelectItem> : null}
                                {buildingOptions.map((building) => (
                                    <SelectItem key={building.id} value={building.id}>
                                        {building.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FilterField>
                    <FilterField label="Date from">
                        <Input
                            type="datetime-local"
                            value={dateFromLocal}
                            onChange={(event) => setDateFromLocal(event.target.value)}
                            className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 text-sm text-zinc-900 shadow-none"
                        />
                    </FilterField>
                    <FilterField label="Date to">
                        <Input
                            type="datetime-local"
                            value={dateToLocal}
                            onChange={(event) => setDateToLocal(event.target.value)}
                            className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 text-sm text-zinc-900 shadow-none"
                        />
                    </FilterField>
                </div>

                <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                        <span className="text-zinc-400">Summary</span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                            <span className="text-zinc-500">Loaded</span>
                            <span className="font-semibold text-zinc-950">{leaseListState.items.length}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                            <span className="text-emerald-700">Active</span>
                            <span className="font-semibold text-emerald-950">{leaseCounts.active}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                            <span className="text-zinc-600">Draft</span>
                            <span className="font-semibold text-zinc-950">{leaseCounts.draft}</span>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                            {status === "ALL" ? "All Contracts" : status}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                            {resolvedSelectedBuildingId === ALL_BUILDINGS ? "All buildings" : activeBuildingLabel}
                        </span>
                        {search.trim() ? (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                Search: {search.trim()}
                            </span>
                        ) : null}
                        {(dateFromLocal || dateToLocal) ? (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                Date range active
                            </span>
                        ) : null}
                        <span className="rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                            Showing {leaseListState.items.length} contract{leaseListState.items.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {canSeePendingTab ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-900">Move operations live in one workspace now.</div>
                            <p className="text-xs text-zinc-500">
                                Review requests, execute approvals, and check resolved history without leaving the contracts module.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => focusOperationsSection("review")}>
                            Open Move Operations
                        </Button>
                    </div>
                ) : null}

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
                                                        className={getStatusBadgeClassName(getLeaseBadgeStatus(lease))}
                                                    >
                                                        {getLeaseBadgeLabel(lease)}
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
                                                                        className={getStatusBadgeClassName(getLeaseBadgeStatus(lease))}
                                                                        >
                                                                            {getLeaseBadgeLabel(lease)}
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
            </section>
                </TabsContent>

                {canSeePendingTab ? (
                    <TabsContent value="operations">
                        <section className="space-y-6 rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">Move Operations</h2>
                                    <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                                        Review incoming requests, execute approved moves, and keep resolved history nearby without
                                        splitting the workflow across separate tabs.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                        {resolvedSelectedBuildingId === ALL_BUILDINGS ? "All buildings" : activeBuildingLabel}
                                    </span>
                                    <span className="rounded-full border border-zinc-900 bg-zinc-950 px-3 py-1.5 font-medium text-white">
                                        {operationsCount} active item{operationsCount === 1 ? "" : "s"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={() => focusOperationsSection("review")}
                                    className={`rounded-2xl border p-4 text-left transition ${
                                        operationsSection === "review"
                                            ? "border-zinc-900 bg-zinc-950 text-white"
                                            : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                                    }`}
                                >
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-current/60">Review Requests</div>
                                    <div className="mt-2 text-3xl font-bold tracking-tight">{reviewEntries.length}</div>
                                    <p className="mt-2 text-sm text-current/70">Pending approvals across move-in and move-out.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => focusOperationsSection("ready")}
                                    className={`rounded-2xl border p-4 text-left transition ${
                                        operationsSection === "ready"
                                            ? "border-zinc-900 bg-zinc-950 text-white"
                                            : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                                    }`}
                                >
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-current/60">Ready to Execute</div>
                                    <div className="mt-2 text-3xl font-bold tracking-tight">{readyEntries.length}</div>
                                    <p className="mt-2 text-sm text-current/70">Approved requests waiting on final move execution.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => focusOperationsSection("history")}
                                    className={`rounded-2xl border p-4 text-left transition ${
                                        operationsSection === "history"
                                            ? "border-zinc-900 bg-zinc-950 text-white"
                                            : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                                    }`}
                                >
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-current/60">Resolved / History</div>
                                    <div className="mt-2 text-3xl font-bold tracking-tight">{resolvedEntries.length}</div>
                                    <p className="mt-2 text-sm text-current/70">Rejected, cancelled, and completed requests.</p>
                                </button>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-5">
                                <FilterField label="Building">
                                    <Select value={resolvedSelectedBuildingId} onValueChange={setSelectedBuildingId}>
                                        <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {canQueryOrgWideLeases ? <SelectItem value={ALL_BUILDINGS}>All buildings</SelectItem> : null}
                                            {buildingOptions.map((building) => (
                                                <SelectItem key={building.id} value={building.id}>
                                                    {building.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                                <FilterField label="Move Type">
                                    <Select value={moveTypeFilter} onValueChange={(value) => setMoveTypeFilter(value as MoveRequestTypeFilter)}>
                                        <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All move types</SelectItem>
                                            <SelectItem value="move-in">Move-In</SelectItem>
                                            <SelectItem value="move-out">Move-Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FilterField>
                                <FilterField label="Status Scope">
                                    {operationsSection === "history" ? (
                                        <Select
                                            value={resolvedStatusFilter}
                                            onValueChange={(value) => setResolvedStatusFilter(value as ResolvedRequestStatusFilter)}
                                        >
                                            <SelectTrigger className="h-11 w-full rounded-2xl border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 shadow-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">All resolved</SelectItem>
                                                <SelectItem value="REJECTED">Rejected</SelectItem>
                                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="flex h-11 items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600">
                                            {operationsSection === "ready" ? "Approved only" : "Pending review"}
                                        </div>
                                    )}
                                </FilterField>
                                <div className="lg:col-span-2">
                                    <FilterField label="Search">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input
                                                value={operationsSearch}
                                                onChange={(event) => setOperationsSearch(event.target.value)}
                                                placeholder="Search resident, unit, notes..."
                                                className="h-11 rounded-2xl border-zinc-200 bg-zinc-50 pl-9 text-sm text-zinc-900 shadow-none placeholder:text-zinc-400"
                                            />
                                        </div>
                                    </FilterField>
                                </div>
                            </div>

                            <section
                                id="move-operations-review"
                                className={`scroll-mt-24 rounded-[24px] border p-5 ${
                                    operationsSection === "review" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"
                                }`}
                            >
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-zinc-900">Review Requests</h3>
                                        <p className="text-sm text-zinc-500">
                                            Start here for incoming requests that still need an approval decision.
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                                        {reviewEntries.length} pending
                                    </Badge>
                                </div>
                                {renderMoveRequestTable(reviewEntries, {
                                    emptyText: "No move requests need review for the selected filters.",
                                    isLoading: reviewSectionLoading,
                                    isError: reviewSectionError,
                                    onRetry: () => {
                                        void Promise.all([reviewMoveInRequestsQuery.refetch(), reviewMoveOutRequestsQuery.refetch()]);
                                    },
                                    enableApproveReject: true,
                                })}
                            </section>
                            <section
                                id="move-operations-ready"
                                className={`scroll-mt-24 rounded-[24px] border p-5 ${
                                    operationsSection === "ready" ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"
                                }`}
                            >
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-zinc-900">Ready to Execute</h3>
                                        <p className="text-sm text-zinc-500">
                                            Approved requests stay here until the physical move-in or move-out is completed.
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                                        {readyEntries.length} approved
                                    </Badge>
                                </div>
                                {renderMoveRequestTable(readyEntries, {
                                    emptyText: "No approved move requests are waiting for execution.",
                                    isLoading: readySectionLoading,
                                    isError: readySectionError,
                                    onRetry: () => {
                                        void Promise.all([readyMoveInRequestsQuery.refetch(), readyMoveOutRequestsQuery.refetch()]);
                                    },
                                    enableExecute: true,
                                })}
                            </section>
                            <section
                                id="move-operations-history"
                                className={`scroll-mt-24 rounded-[24px] border p-5 ${
                                    isHistoryExpanded ? "border-zinc-200 bg-zinc-50/70" : "border-zinc-200 bg-zinc-50/30"
                                }`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-zinc-900">Resolved / History</h3>
                                        <p className="text-sm text-zinc-500">
                                            Keep resolved requests close by without giving them equal weight in the main workflow.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                                            {resolvedEntries.length} resolved
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setOperationsSection(isHistoryExpanded ? "review" : "history")}
                                        >
                                            {isHistoryExpanded ? "Hide history" : "Show history"}
                                        </Button>
                                    </div>
                                </div>

                                {isHistoryExpanded ? (
                                    <div className="mt-4">
                                        {renderMoveRequestTable(resolvedEntries, {
                                            emptyText: "No resolved move requests match the current filters.",
                                            isLoading: historySectionLoading,
                                            isError: historySectionError,
                                            onRetry: () => {
                                                void Promise.all([
                                                    rejectedMoveInRequestsQuery.refetch(),
                                                    rejectedMoveOutRequestsQuery.refetch(),
                                                    cancelledMoveInRequestsQuery.refetch(),
                                                    cancelledMoveOutRequestsQuery.refetch(),
                                                    completedMoveInRequestsQuery.refetch(),
                                                    completedMoveOutRequestsQuery.refetch(),
                                                ]);
                                            },
                                        })}
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-5 text-sm text-zinc-500">
                                        Expand this section when you need completed, cancelled, or rejected requests.
                                    </div>
                                )}
                            </section>
                        </section>
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
                    onOpenChange={(open) => {
                        setAddContractOpen(open);
                        if (!open) {
                            setAddContractPrefill(null);
                            if (addContractActionFromQuery) {
                                clearAddContractSearchParams();
                            }
                        }
                    }}
                    buildingId={selectedBuildingForActions}
                    prefill={addContractPrefill}
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
