import type { ContractMoveRequest, Lease, OrgLeaseStatusFilter, TimelineOrder } from "@/lib/types";

export const ALL_BUILDINGS = "__ALL__";
export const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type LeaseViewMode = "flat" | "grouped";
export type LeasePageTab = "leases" | "pending" | "execute-move-in";
export type MoveRequestType = "move-in" | "move-out";
export type PendingQueueType = "move-in" | "move-out";

export interface RejectRequestContext {
    requestId: string;
    requestType: PendingQueueType;
}

export interface LeaseResidentGroup {
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

export interface CursorListState<T> {
    cursor: string | null;
    items: T[];
    nextCursor: string | null;
}

export type CursorListAction<T> =
    | { type: "reset" }
    | { type: "setCursor"; cursor: string | null }
    | { type: "append"; cursor: string | null; items: T[]; nextCursor: string | null };

export const isOrgLeaseStatusFilter = (value: string | null): value is OrgLeaseStatusFilter =>
    value === "ALL" || value === "DRAFT" || value === "ACTIVE" || value === "ENDED" || value === "CANCELLED";

export const isTimelineOrder = (value: string | null): value is TimelineOrder =>
    value === "asc" || value === "desc";

export const isLeaseViewMode = (value: string | null): value is LeaseViewMode =>
    value === "flat" || value === "grouped";

export const isLeasePageTab = (value: string | null): value is LeasePageTab =>
    value === "leases" || value === "pending" || value === "execute-move-in";

export const isPendingQueueType = (value: string | null): value is PendingQueueType =>
    value === "move-in" || value === "move-out";

export const isContractMoveRequestStatusFilter = (value: string | null): value is ContractMoveRequest["status"] | "ALL" =>
    value === "PENDING"
    || value === "APPROVED"
    || value === "REJECTED"
    || value === "CANCELLED"
    || value === "COMPLETED"
    || value === "ALL";
