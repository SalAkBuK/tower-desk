import type { ContractMoveRequest, Lease } from "@/lib/types";
import type { CursorListAction, CursorListState, LeaseResidentGroup } from "./types";
import { DATETIME_LOCAL_PATTERN } from "./types";

export const toDateTimeLocalInput = (value: string | null) => {
    if (!value) return "";
    if (DATETIME_LOCAL_PATTERN.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toDateTimeLocalFromDate = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
};

export const formatDateTime = (value?: string | null) => {
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

export const formatMoney = (value?: string | number | null) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "string" ? Number(value) : value;
    if (Number.isNaN(num)) return String(value);
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
};

export const mergeById = (prev: Lease[], next: Lease[]) => {
    const map = new Map<string, Lease>();
    prev.forEach((item) => map.set(item.id, item));
    next.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
};

export const initialCursorListState = <T,>(): CursorListState<T> => ({
    cursor: null,
    items: [],
    nextCursor: null,
});

export const createCursorListReducer = <T,>(merge: (prev: T[], next: T[]) => T[]) =>
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

export const toIsoOrUndefined = (value: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
};

export const toErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || !error) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
};

export const toComparableTime = (value?: string | null) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

export const compareLeasesByResidentGroup = (a: Lease, b: Lease) => {
    if (a.status !== b.status) {
        if (a.status === "ACTIVE") return -1;
        if (b.status === "ACTIVE") return 1;
    }
    const aStart = toComparableTime(a.leaseStartDate);
    const bStart = toComparableTime(b.leaseStartDate);
    if (aStart !== bStart) return bStart - aStart;
    return a.id.localeCompare(b.id);
};

export const groupLeasesByResident = (leases: Lease[]) => {
    const map = new Map<string, LeaseResidentGroup>();
    leases.forEach((lease) => {
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
};

export const getStatusBadgeClassName = (status: Lease["status"]) => {
    if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "DRAFT") return "bg-blue-50 text-blue-700 border-blue-200";
    if (status === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

export const getMoveRequestStatusBadgeClassName = (status: ContractMoveRequest["status"]) => {
    if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "APPROVED") return "bg-blue-50 text-blue-700 border-blue-200";
    if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "REJECTED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

export const getLeaseActionAvailability = (lease: Lease, canWriteLease: boolean) => ({
    canActivateContract: canWriteLease && lease.status === "DRAFT",
    canCancelContract: canWriteLease && (lease.status === "DRAFT" || lease.status === "ACTIVE"),
    canEditContract: canWriteLease,
});

export const getMoveRequestRowMeta = (request: ContractMoveRequest) => {
    const requestContractId = request.contractId || request.leaseId;
    return {
        requestContractId,
        canApproveReject: request.status === "PENDING",
        canExecute: request.status === "APPROVED" && Boolean(requestContractId),
    };
};
