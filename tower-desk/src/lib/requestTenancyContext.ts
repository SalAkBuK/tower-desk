import type { RequestTenancyContext, RequestTenancyContextSource } from "@/lib/types";

const requestTenancyBadgeLabels = {
    CURRENT_OCCUPANCY: "Current Occupancy",
    PREVIOUS_OCCUPANCY: "Previous Occupancy",
    NO_ACTIVE_OCCUPANCY: "No Active Occupancy",
    UNKNOWN_TENANCY_CYCLE: "Legacy Request",
} as const;

const requestLeaseBadgeLabels = {
    CURRENT_LEASE: "Current Lease",
    PREVIOUS_LEASE: "Previous Lease",
    NO_ACTIVE_LEASE: "No Active Lease",
    UNKNOWN_LEASE_CYCLE: "Legacy Lease Context",
} as const;

const requestTenancyRowBadgeLabels = {
    CURRENT_OCCUPANCY: "Current Stay",
    PREVIOUS_OCCUPANCY: "Previous Stay",
    NO_ACTIVE_OCCUPANCY: "Requester Moved Out",
    UNKNOWN_TENANCY_CYCLE: "Legacy Record",
} as const;

const requestLeaseRowBadgeLabels = {
    CURRENT_LEASE: "Current Lease",
    PREVIOUS_LEASE: "Previous Lease",
    NO_ACTIVE_LEASE: "Previous Lease",
    UNKNOWN_LEASE_CYCLE: "Legacy Lease",
} as const;

const requestTenancySourceLabels: Record<RequestTenancyContextSource, string> = {
    SNAPSHOT: "Explicit creation snapshot",
    HISTORICAL_INFERENCE: "Resolved from history",
    UNRESOLVED: "Unresolved legacy context",
};

const managementRequestTenancySourceLabels: Record<RequestTenancyContextSource, string | null> = {
    SNAPSHOT: null,
    HISTORICAL_INFERENCE: "Inferred from history",
    UNRESOLVED: "Legacy linkage is incomplete",
};

export type RequestTenancyBucket = "CURRENT" | "HISTORICAL" | "LEGACY";

const LEGACY_TENANCY_LABEL = requestTenancyBadgeLabels.UNKNOWN_TENANCY_CYCLE;
const LEGACY_LEASE_LABEL = requestLeaseBadgeLabels.UNKNOWN_LEASE_CYCLE;

export const getRequestTenancyBucket = (context?: RequestTenancyContext | null): RequestTenancyBucket => {
    switch (context?.label) {
        case "CURRENT_OCCUPANCY":
            return "CURRENT";
        case "PREVIOUS_OCCUPANCY":
        case "NO_ACTIVE_OCCUPANCY":
            return "HISTORICAL";
        case "UNKNOWN_TENANCY_CYCLE":
        default:
            return "LEGACY";
    }
};

export const isCurrentRequestTenancyContext = (context?: RequestTenancyContext | null) =>
    getRequestTenancyBucket(context) === "CURRENT";

export const isHistoricalRequestTenancyContext = (context?: RequestTenancyContext | null) =>
    getRequestTenancyBucket(context) === "HISTORICAL";

export const isLegacyRequestTenancyContext = (context?: RequestTenancyContext | null) =>
    getRequestTenancyBucket(context) === "LEGACY";

export const getRequestTenancyBadgeLabel = (context?: RequestTenancyContext | null) => {
    if (!context?.label) return LEGACY_TENANCY_LABEL;
    return requestTenancyBadgeLabels[context.label] ?? LEGACY_TENANCY_LABEL;
};

export const getRequestLeaseBadgeLabel = (context?: RequestTenancyContext | null) => {
    if (!context?.leaseLabel) return LEGACY_LEASE_LABEL;
    return requestLeaseBadgeLabels[context.leaseLabel] ?? LEGACY_LEASE_LABEL;
};

export const getRequestTenancyRowBadgeLabel = (context?: RequestTenancyContext | null) => {
    if (!context?.label) return requestTenancyRowBadgeLabels.UNKNOWN_TENANCY_CYCLE;
    return requestTenancyRowBadgeLabels[context.label] ?? requestTenancyRowBadgeLabels.UNKNOWN_TENANCY_CYCLE;
};

export const getRequestLeaseRowBadgeLabel = (context?: RequestTenancyContext | null) => {
    if (!context?.leaseLabel) return requestLeaseRowBadgeLabels.UNKNOWN_LEASE_CYCLE;
    return requestLeaseRowBadgeLabels[context.leaseLabel] ?? requestLeaseRowBadgeLabels.UNKNOWN_LEASE_CYCLE;
};

const getRequestTenancySourceLabel = (source?: RequestTenancyContextSource | null, fallback = false) => {
    if (source) return requestTenancySourceLabels[source];
    return fallback ? requestTenancySourceLabels.UNRESOLVED : null;
};

export const getRequestTenancySourceText = (context?: RequestTenancyContext | null) =>
    getRequestTenancySourceLabel(context?.tenancyContextSource, isLegacyRequestTenancyContext(context));

export const getRequestLeaseSourceText = (context?: RequestTenancyContext | null) =>
    getRequestTenancySourceLabel(context?.leaseContextSource, context?.leaseLabel === "UNKNOWN_LEASE_CYCLE");

const getManagementRequestSourceText = (source?: RequestTenancyContextSource | null, fallback = false) => {
    if (source) return managementRequestTenancySourceLabels[source];
    return fallback ? managementRequestTenancySourceLabels.UNRESOLVED : null;
};

export const getManagementRequestTenancySourceText = (context?: RequestTenancyContext | null) =>
    getManagementRequestSourceText(context?.tenancyContextSource, isLegacyRequestTenancyContext(context));

export const getManagementRequestLeaseSourceText = (context?: RequestTenancyContext | null) =>
    getManagementRequestSourceText(context?.leaseContextSource, context?.leaseLabel === "UNKNOWN_LEASE_CYCLE");

export const getRequestTenancyListPillLabel = (context?: RequestTenancyContext | null) => {
    if (getRequestTenancyBucket(context) !== "CURRENT") {
        return getRequestTenancyBadgeLabel(context);
    }

    if (context?.leaseLabel && context.leaseLabel !== "CURRENT_LEASE") {
        return requestLeaseBadgeLabels[context.leaseLabel] ?? LEGACY_LEASE_LABEL;
    }

    return null;
};
