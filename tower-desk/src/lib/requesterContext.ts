import type { RequesterContext, ServiceRequest } from "@/lib/types";

const requesterStatusBadgeLabels = {
    ACTIVE: "Active Resident",
    FORMER: "Former Resident",
    NONE: "Invited / Pre-move-in Resident",
} as const;

const managementRequesterStatusLabels = {
    ACTIVE: "Current resident",
    FORMER: "Former resident",
    NONE: "Pre-move-in resident",
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

export const getManagementRequesterStatusLabel = (context?: RequesterContext | null) => {
    if (!context?.residentOccupancyStatus) return null;
    return managementRequesterStatusLabels[context.residentOccupancyStatus] ?? null;
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

export const getManagementRequesterOccupancyLabel = (request?: ServiceRequest | null) => {
    const context = request?.requesterContext;
    if (!context) return "No current occupancy context";

    if (context.currentUnitOccupiedByRequester === true) {
        return "Requester still occupies this unit";
    }

    const currentOccupant = getRequesterCurrentOccupantLabel(request);
    if (currentOccupant) {
        return `Occupied by ${currentOccupant}`;
    }

    if (context.currentUnitOccupiedByRequester === false) {
        return "Requester is not the current occupant";
    }

    return "No current occupant recorded";
};

export const getManagementRequesterInviteLabel = (context?: RequesterContext | null) => {
    if (!context?.residentInviteStatus) return null;
    if (context.residentOccupancyStatus !== "NONE") return null;
    return requesterInviteStatusLabels[context.residentInviteStatus] ?? null;
};

export const getManagementRequesterContextNotes = (request?: ServiceRequest | null) => {
    const notes: string[] = [];
    if (!request?.requesterContext) return notes;

    if (request.requesterContext.isFormerResident) {
        notes.push("Historical request from a former resident.");
    }

    if (request.requesterContext.currentUnitOccupiedByRequester === false) {
        notes.push("This unit is now occupied by someone else or no longer occupied by the requester.");
    }

    return notes;
};
