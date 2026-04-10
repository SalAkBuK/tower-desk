import type { LeaseDisplayStatus, LeaseStatus } from "./types";

const LEASE_STATUSES: LeaseStatus[] = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"];
const LEASE_DISPLAY_STATUSES: LeaseDisplayStatus[] = [...LEASE_STATUSES, "MOVED_OUT"];

const normalizeKnownStatus = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    return allowed.includes(normalized as T) ? (normalized as T) : fallback;
};

const findKnownStatus = <T extends string>(value: unknown, allowed: readonly T[]) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    return allowed.includes(normalized as T) ? (normalized as T) : null;
};

export const normalizeLeaseStatus = (value: unknown): LeaseStatus =>
    normalizeKnownStatus(value, LEASE_STATUSES, "ACTIVE");

export const hasLeaseMoveOutMarker = (source?: {
    actualMoveOutDate?: unknown;
    actual_move_out_date?: unknown;
    moveOutDate?: unknown;
    move_out_date?: unknown;
    movedOutAt?: unknown;
    moved_out_at?: unknown;
    occupancyEndAt?: unknown;
    occupancy_end_at?: unknown;
    occupancy?: {
        endedAt?: unknown;
        ended_at?: unknown;
        endAt?: unknown;
        end_at?: unknown;
        status?: unknown;
    } | null;
}, action?: unknown) => {
    const normalizedAction = String(action ?? "").trim().toUpperCase();
    return (
        normalizedAction === "MOVED_OUT" ||
        source?.actualMoveOutDate != null ||
        source?.actual_move_out_date != null ||
        source?.moveOutDate != null ||
        source?.move_out_date != null ||
        source?.movedOutAt != null ||
        source?.moved_out_at != null ||
        source?.occupancyEndAt != null ||
        source?.occupancy_end_at != null ||
        source?.occupancy?.endedAt != null ||
        source?.occupancy?.ended_at != null ||
        source?.occupancy?.endAt != null ||
        source?.occupancy?.end_at != null ||
        String(source?.occupancy?.status ?? "").trim().toUpperCase() === "ENDED"
    );
};

export const deriveLeaseDisplayStatus = (
    rawStatus: unknown,
    source?: {
        displayStatus?: unknown;
        display_status?: unknown;
    } & Parameters<typeof hasLeaseMoveOutMarker>[0],
    action?: unknown,
): LeaseDisplayStatus => {
    const explicitDisplayStatus = findKnownStatus(
        source?.displayStatus ?? source?.display_status,
        LEASE_DISPLAY_STATUSES,
    );
    if (explicitDisplayStatus) {
        return explicitDisplayStatus;
    }

    const status = normalizeLeaseStatus(rawStatus);
    if (status === "ENDED") return "MOVED_OUT";
    if (status === "CANCELLED" && hasLeaseMoveOutMarker(source, action)) return "MOVED_OUT";
    return status;
};

type LeaseDisplayStatusSource = {
    status: LeaseStatus;
    displayStatus?: LeaseDisplayStatus;
    actualMoveOutDate?: string | null;
};

export const getLeaseDisplayStatus = (lease: LeaseDisplayStatusSource) =>
    lease.displayStatus ?? deriveLeaseDisplayStatus(lease.status, { actualMoveOutDate: lease.actualMoveOutDate });

export const formatLeaseDisplayStatus = (status: LeaseDisplayStatus) =>
    status === "MOVED_OUT" ? "Moved Out" : status;

export const getLeaseStatusBadgeClassName = (status: LeaseDisplayStatus) => {
    if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "DRAFT") return "bg-blue-50 text-blue-700 border-blue-200";
    if (status === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
};
