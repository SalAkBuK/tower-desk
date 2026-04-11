import type { RequesterContext, ServiceRequest } from "@/lib/types";

const requesterStatusBadgeLabels = {
    ACTIVE: "Active Resident",
    FORMER: "Former Resident",
    NONE: "Invited / Pre-move-in Resident",
} as const;

export const requesterInviteStatusLabels = {
    PENDING: "Pending invite",
    ACCEPTED: "Accepted invite",
    FAILED: "Failed invite",
    EXPIRED: "Expired invite",
} as const;

const getRequesterId = (request?: ServiceRequest | null) =>
    request?.createdBy?.id ?? request?.createdByTenantId ?? null;

export const getRequesterStatusBadgeLabel = (context?: RequesterContext | null) => {
    if (!context?.residentOccupancyStatus) return null;
    return requesterStatusBadgeLabels[context.residentOccupancyStatus] ?? null;
};

export const getRequesterCurrentOccupantLabel = (request?: ServiceRequest | null) => {
    const occupant = request?.requesterContext?.currentUnitOccupant;
    if (!occupant) return null;
    if (request?.requesterContext?.currentUnitOccupiedByRequester === true) return null;

    const requesterId = getRequesterId(request);
    if (requesterId && occupant.userId === requesterId) return null;

    return occupant.name ?? occupant.userId;
};

export const getRequesterContextNotes = (request?: ServiceRequest | null) => {
    const notes: string[] = [];
    if (!request?.requesterContext) return notes;

    if (request.requesterContext.isFormerResident) {
        notes.push("Requester no longer has an active occupancy. This request remains visible as a historical record.");
    }

    if (request.requesterContext.currentUnitOccupiedByRequester === false) {
        notes.push("Current occupant is different from the original requester.");
    }

    return notes;
};
