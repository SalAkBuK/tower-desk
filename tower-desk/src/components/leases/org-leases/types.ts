import type { ContractMoveRequest, Lease, OrgLeaseStatusFilter, TimelineOrder } from "@/lib/types";

export const ALL_BUILDINGS = "__ALL__";
export const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type LeaseViewMode = "flat" | "grouped";
export type LeasePageTab = "leases" | "operations";
export type LegacyLeasePageTab = "pending" | "execute-move-in" | "execute-move-out";
export type MoveOperationsSection = "review" | "ready" | "history";
export type MoveRequestType = "move-in" | "move-out";
export type PendingQueueType = "move-in" | "move-out";
export type MoveRequestTypeFilter = "all" | PendingQueueType;
export type ResolvedRequestStatusFilter = "ALL" | "REJECTED" | "CANCELLED" | "COMPLETED";

export interface RejectRequestContext {
    requestId: string;
    requestType: PendingQueueType;
    buildingId?: string;
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
    value === "leases" || value === "operations";

export const isLegacyLeasePageTab = (value: string | null): value is LegacyLeasePageTab =>
    value === "pending" || value === "execute-move-in" || value === "execute-move-out";

export const isMoveOperationsSection = (value: string | null): value is MoveOperationsSection =>
    value === "review" || value === "ready" || value === "history";

export const isPendingQueueType = (value: string | null): value is PendingQueueType =>
    value === "move-in" || value === "move-out";

export const isMoveRequestTypeFilter = (value: string | null): value is MoveRequestTypeFilter =>
    value === "all" || value === "move-in" || value === "move-out";

export const isContractMoveRequestStatusFilter = (value: string | null): value is ContractMoveRequest["status"] | "ALL" =>
    value === "PENDING"
    || value === "APPROVED"
    || value === "REJECTED"
    || value === "CANCELLED"
    || value === "COMPLETED"
    || value === "ALL";

export const isResolvedRequestStatusFilter = (value: string | null): value is ResolvedRequestStatusFilter =>
    value === "ALL"
    || value === "REJECTED"
    || value === "CANCELLED"
    || value === "COMPLETED";
